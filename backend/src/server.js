import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import amqp from 'amqplib';
import { logger } from './utils/logger.js';
import { validateCheckIn, validateWebhook } from './utils/validators.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const prisma = new PrismaClient();
let channel = null;
let rabbitmqConnection = null;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ============================================
// RabbitMQ Connection
// ============================================

async function connectRabbitMQ() {
  try {
    rabbitmqConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
    channel = await rabbitmqConnection.createChannel();
    
    // Assert queue
    await channel.assertExchange('badge_exchange', 'direct', { durable: true });
    await channel.assertQueue(process.env.RABBITMQ_QUEUE_NAME || 'badge_print_requests', {
      durable: true
    });
    await channel.bindQueue(
      process.env.RABBITMQ_QUEUE_NAME || 'badge_print_requests',
      'badge_exchange',
      'print.request'
    );
    
    logger.info('✓ Connected to RabbitMQ');
    return true;
  } catch (error) {
    logger.error('RabbitMQ connection failed:', error);
    return false;
  }
}

// ============================================
// API Routes
// ============================================

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    // Test database
    await prisma.$queryRaw`SELECT 1`;
    
    const services = {
      database: 'connected',
      rabbitmq: channel ? 'connected' : 'disconnected',
      api: 'online'
    };

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      services: {
        database: 'disconnected',
        rabbitmq: channel ? 'connected' : 'disconnected',
        api: 'online'
      }
    });
  }
});

// Check-In Endpoint
app.post('/api/check-in', async (req, res) => {
  try {
    const { error, value } = validateCheckIn(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { qrCode } = value;

    // Find attendee
    const attendee = await prisma.attendee.findUnique({
      where: { qrCode }
    });

    if (!attendee) {
      logger.warn(`Invalid QR code scanned: ${qrCode}`);
      return res.status(404).json({ error: 'Attendee not found' });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        attendeeId: attendee.id,
        action: 'QR_SCANNED',
        description: `QR code ${qrCode} scanned`,
        metadata: { qrCode }
      }
    });

    // Check current status
    if (attendee.status === 'CHECKED_IN') {
      logger.warn(`Duplicate scan blocked (already checked in): ${attendee.id}`);
      await prisma.activityLog.create({
        data: {
          attendeeId: attendee.id,
          action: 'DUPLICATE_SCAN_BLOCKED',
          description: 'Duplicate scan - attendee already checked in'
        }
      });
      
      io.emit('checkin:duplicate', {
        attendeeId: attendee.id,
        currentStatus: 'CHECKED_IN'
      });

      return res.status(409).json({
        error: 'Attendee already checked in'
      });
    }

    if (attendee.status === 'PENDING_PRINT') {
      logger.warn(`Duplicate scan blocked (pending): ${attendee.id}`);
      await prisma.activityLog.create({
        data: {
          attendeeId: attendee.id,
          action: 'DUPLICATE_SCAN_BLOCKED',
          description: 'Duplicate scan - badge print in progress'
        }
      });
      
      io.emit('checkin:duplicate', {
        attendeeId: attendee.id,
        currentStatus: 'PENDING_PRINT'
      });

      return res.status(409).json({
        error: 'Badge print already in progress'
      });
    }

    // Use transaction to create print job and update attendee atomically
    const result = await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction (FOR UPDATE lock)
      const attendeeInTx = await tx.attendee.findUnique({
        where: { id: attendee.id }
      });

      if (attendeeInTx.status !== 'NOT_CHECKED_IN' && attendeeInTx.status !== 'FAILED') {
        throw new Error('STATUS_CHANGED');
      }

      // Create print job
      const printJob = await tx.printJob.create({
        data: {
          id: `JOB-${uuidv4()}`,
          attendeeId: attendee.id,
          status: 'CREATED',
          queuedAt: new Date()
        }
      });

      // Update attendee status
      const updatedAttendee = await tx.attendee.update({
        where: { id: attendee.id },
        data: { status: 'PENDING_PRINT' }
      });

      return { printJob, attendee: updatedAttendee };
    });

    const { printJob, attendee: updatedAttendee } = result;

    // Log activity
    await prisma.activityLog.create({
      data: {
        attendeeId: attendee.id,
        printJobId: printJob.id,
        action: 'PRINT_JOB_CREATED',
        description: `Print job created: ${printJob.id}`
      }
    });

    // Publish to RabbitMQ
    const message = {
      printJobId: printJob.id,
      attendeeId: attendee.id,
      attendeeName: attendee.name,
      qrCode: attendee.qrCode,
      attemptNumber: printJob.attemptCount,
      timestamp: new Date().toISOString()
    };

    if (channel) {
      channel.publish(
        'badge_exchange',
        'print.request',
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      // Update job status
      await prisma.printJob.update({
        where: { id: printJob.id },
        data: { status: 'QUEUED' }
      });

      await prisma.activityLog.create({
        data: {
          attendeeId: attendee.id,
          printJobId: printJob.id,
          action: 'PRINT_JOB_QUEUED',
          description: `Print job queued to RabbitMQ`
        }
      });
    }

    // Emit Socket.IO event
    io.emit('checkin:submitted', {
      attendeeId: attendee.id,
      attendeeName: attendee.name,
      printJobId: printJob.id
    });

    logger.info(`Check-in accepted: ${attendee.name} (${printJob.id})`);

    res.status(202).json({
      success: true,
      message: 'Print job created successfully',
      attendee: {
        id: updatedAttendee.id,
        name: updatedAttendee.name,
        status: updatedAttendee.status
      },
      printJob: {
        id: printJob.id,
        status: printJob.status
      }
    });
  } catch (error) {
    if (error.message === 'STATUS_CHANGED') {
      logger.warn('Race condition detected - status changed during transaction');
      return res.status(409).json({ error: 'Race condition detected' });
    }
    logger.error('Check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Attendees
app.get('/api/attendees', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [data, total] = await Promise.all([
      prisma.attendee.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          email: true,
          qrCode: true,
          status: true,
          createdAt: true
        }
      }),
      prisma.attendee.count({ where })
    ]);

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get attendees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Attendee by ID
app.get('/api/attendees/:id', async (req, res) => {
  try {
    const attendee = await prisma.attendee.findUnique({
      where: { id: req.params.id },
      include: {
        printJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    res.json(attendee);
  } catch (error) {
    logger.error('Get attendee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [totalRegistered, checkedIn, pendingPrint, failed] = await Promise.all([
      prisma.attendee.count(),
      prisma.attendee.count({ where: { status: 'CHECKED_IN' } }),
      prisma.attendee.count({ where: { status: 'PENDING_PRINT' } }),
      prisma.attendee.count({ where: { status: 'FAILED' } })
    ]);

    res.json({
      totalRegistered,
      checkedIn,
      pendingPrint,
      failed,
      remaining: totalRegistered - checkedIn - pendingPrint - failed
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook - Print Complete
app.post('/api/webhooks/print-complete', async (req, res) => {
  try {
    const { error, value } = validateWebhook(req.body);
    if (error) {
      logger.warn('Invalid webhook payload:', error.message);
      return res.status(400).json({ error: error.message });
    }

    const { printJobId, status, completedAt, error: printError } = value;

    logger.info(`Webhook received for job ${printJobId}: ${status}`);

    // Find print job
    const printJob = await prisma.printJob.findUnique({
      where: { id: printJobId },
      include: { attendee: true }
    });

    if (!printJob) {
      logger.warn(`Webhook received for unknown job: ${printJobId}`);
      return res.status(200).json({ received: true, processed: false });
    }

    // Check if already processed (idempotency)
    if (printJob.status === 'SUCCESS' || printJob.status === 'FAILED') {
      logger.info(`Webhook duplicate for job ${printJobId} - already processed`);
      await prisma.activityLog.create({
        data: {
          printJobId: printJob.id,
          attendeeId: printJob.attendeeId,
          action: 'WEBHOOK_DUPLICATE',
          description: `Duplicate webhook received for job ${printJobId}`
        }
      });
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Update print job
    const updatedJob = await prisma.printJob.update({
      where: { id: printJobId },
      data: {
        status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        completedAt: new Date(completedAt),
        errorMessage: printError || null
      }
    });

    // Update attendee status
    const updatedAttendee = await prisma.attendee.update({
      where: { id: printJob.attendeeId },
      data: {
        status: status === 'SUCCESS' ? 'CHECKED_IN' : 'FAILED'
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        attendeeId: printJob.attendeeId,
        printJobId: printJobId,
        action: status === 'SUCCESS' ? 'PRINT_SUCCESS' : 'PRINT_FAILED',
        description: status === 'SUCCESS' 
          ? 'Badge successfully printed and confirmed'
          : `Badge printing failed: ${printError}`,
        metadata: { webhookStatus: status }
      }
    });

    // Emit Socket.IO event
    if (status === 'SUCCESS') {
      io.emit('checkin:success', {
        attendeeId: printJob.attendeeId,
        attendeeName: printJob.attendee.name,
        printJobId: printJobId,
        completedAt
      });
      logger.info(`Check-in completed: ${printJob.attendee.name}`);
    } else {
      io.emit('checkin:failed', {
        attendeeId: printJob.attendeeId,
        printJobId: printJobId,
        error: printError
      });
      logger.warn(`Check-in failed: ${printJob.attendee.name} - ${printError}`);
    }

    res.status(200).json({
      received: true,
      processed: true,
      jobId: printJobId,
      status: updatedJob.status
    });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// Socket.IO
// ============================================

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// ============================================
// Server Startup
// ============================================

const PORT = process.env.BACKEND_PORT || 3000;

async function startServer() {
  try {
    // Connect to database
    await prisma.$connect();
    logger.info('✓ Connected to PostgreSQL');

    // Connect to RabbitMQ
    const rabbitmqConnected = await connectRabbitMQ();
    if (!rabbitmqConnected) {
      logger.warn('⚠ RabbitMQ connection failed - retrying in 5 seconds');
      setTimeout(connectRabbitMQ, 5000);
    }

    // Start server
    server.listen(PORT, () => {
      logger.info(`✓ Backend server running on port ${PORT}`);
      logger.info(`✓ Socket.IO listening on ws://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  if (channel) await channel.close();
  if (rabbitmqConnection) await rabbitmqConnection.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
