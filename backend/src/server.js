import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import { Server } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
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

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    // Test Supabase connection
    const { error: dbError } = await supabase
      .from('attendees')
      .select('count')
      .limit(1);
    
    const services = {
      database: dbError ? 'disconnected' : 'connected',
      rabbitmq: channel ? 'connected' : 'disconnected',
      api: 'online'
    };

    res.json({
      status: dbError ? 'error' : 'ok',
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
    const { data: attendee, error: findError } = await supabase
      .from('attendees')
      .select()
      .eq('qr_code', qrCode)
      .single();

    if (findError || !attendee) {
      logger.warn(`Invalid QR code scanned: ${qrCode}`);
      return res.status(404).json({ error: 'Attendee not found' });
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        attendee_id: attendee.id,
        action: 'QR_SCANNED',
        description: `QR code ${qrCode} scanned`,
        metadata: { qrCode }
      });

    // Check current status
    if (attendee.status === 'CHECKED_IN') {
      logger.warn(`Duplicate scan blocked (already checked in): ${attendee.id}`);
      await supabase
        .from('activity_logs')
        .insert({
          attendee_id: attendee.id,
          action: 'DUPLICATE_SCAN_BLOCKED',
          description: 'Duplicate scan - attendee already checked in'
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
      await supabase
        .from('activity_logs')
        .insert({
          attendee_id: attendee.id,
          action: 'DUPLICATE_SCAN_BLOCKED',
          description: 'Duplicate scan - badge print in progress'
        });
      
      io.emit('checkin:duplicate', {
        attendeeId: attendee.id,
        currentStatus: 'PENDING_PRINT'
      });

      return res.status(409).json({
        error: 'Badge print already in progress'
      });
    }

    // Create print job
    const printJobId = `JOB-${uuidv4()}`;
    
    const { data: printJob, error: jobError } = await supabase
      .from('print_jobs')
      .insert({
        id: printJobId,
        attendee_id: attendee.id,
        status: 'CREATED',
        queued_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      logger.error('Failed to create print job:', jobError);
      return res.status(500).json({ error: 'Failed to create print job' });
    }

    // Update attendee status
    const { error: updateError } = await supabase
      .from('attendees')
      .update({ status: 'PENDING_PRINT', updated_at: new Date().toISOString() })
      .eq('id', attendee.id);

    if (updateError) {
      logger.error('Failed to update attendee status:', updateError);
      return res.status(500).json({ error: 'Failed to update attendee' });
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        attendee_id: attendee.id,
        print_job_id: printJobId,
        action: 'PRINT_JOB_CREATED',
        description: `Print job created: ${printJobId}`
      });

    // Publish to RabbitMQ
    const message = {
      printJobId,
      attendeeId: attendee.id,
      attendeeName: attendee.name,
      qrCode: attendee.qr_code,
      attemptNumber: 1,
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
      await supabase
        .from('print_jobs')
        .update({ status: 'QUEUED' })
        .eq('id', printJobId);

      await supabase
        .from('activity_logs')
        .insert({
          attendee_id: attendee.id,
          print_job_id: printJobId,
          action: 'PRINT_JOB_QUEUED',
          description: 'Print job queued to RabbitMQ'
        });
    }

    // Emit Socket.IO event
    io.emit('checkin:submitted', {
      attendeeId: attendee.id,
      attendeeName: attendee.name,
      printJobId
    });

    logger.info(`Check-in accepted: ${attendee.name} (${printJobId})`);

    res.status(202).json({
      success: true,
      message: 'Print job created successfully',
      attendee: {
        id: attendee.id,
        name: attendee.name,
        status: 'PENDING_PRINT'
      },
      printJob: {
        id: printJobId,
        status: 'QUEUED'
      }
    });
  } catch (error) {
    logger.error('Check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Attendees
app.get('/api/attendees', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase.from('attendees').select();
    
    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range(skip, skip + parseInt(limit) - 1)
      .select('id, name, email, qr_code, status, created_at', { count: 'exact' });

    if (error) {
      logger.error('Get attendees error:', error);
      return res.status(500).json({ error: 'Failed to fetch attendees' });
    }

    res.json({
      data: data.map(a => ({
        ...a,
        qrCode: a.qr_code,
        createdAt: a.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
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
    const { data: attendee, error } = await supabase
      .from('attendees')
      .select()
      .eq('id', req.params.id)
      .single();

    if (error || !attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    // Get print jobs
    const { data: printJobs } = await supabase
      .from('print_jobs')
      .select()
      .eq('attendee_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get activity logs
    const { data: activityLogs } = await supabase
      .from('activity_logs')
      .select()
      .eq('attendee_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({
      ...attendee,
      printJobs: printJobs || [],
      activityLogs: activityLogs || []
    });
  } catch (error) {
    logger.error('Get attendee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { count: totalRegistered } = await supabase
      .from('attendees')
      .select('id', { count: 'exact' });

    const { count: checkedIn } = await supabase
      .from('attendees')
      .select('id', { count: 'exact' })
      .eq('status', 'CHECKED_IN');

    const { count: pendingPrint } = await supabase
      .from('attendees')
      .select('id', { count: 'exact' })
      .eq('status', 'PENDING_PRINT');

    const { count: failed } = await supabase
      .from('attendees')
      .select('id', { count: 'exact' })
      .eq('status', 'FAILED');

    res.json({
      totalRegistered: totalRegistered || 0,
      checkedIn: checkedIn || 0,
      pendingPrint: pendingPrint || 0,
      failed: failed || 0,
      remaining: (totalRegistered || 0) - (checkedIn || 0) - (pendingPrint || 0) - (failed || 0)
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
    const { data: printJob, error: jobError } = await supabase
      .from('print_jobs')
      .select()
      .eq('id', printJobId)
      .single();

    if (jobError || !printJob) {
      logger.warn(`Webhook received for unknown job: ${printJobId}`);
      return res.status(200).json({ received: true, processed: false });
    }

    // Check if already processed (idempotency)
    if (printJob.status === 'SUCCESS' || printJob.status === 'FAILED') {
      logger.info(`Webhook duplicate for job ${printJobId} - already processed`);
      await supabase
        .from('activity_logs')
        .insert({
          print_job_id: printJob.id,
          attendee_id: printJob.attendee_id,
          action: 'WEBHOOK_DUPLICATE',
          description: `Duplicate webhook received for job ${printJobId}`
        });
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // Update print job
    const { error: updateJobError } = await supabase
      .from('print_jobs')
      .update({
        status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        completed_at: completedAt,
        error_message: printError || null
      })
      .eq('id', printJobId);

    if (updateJobError) {
      logger.error('Failed to update print job:', updateJobError);
      return res.status(500).json({ error: 'Failed to update print job' });
    }

    // Update attendee status
    const { error: updateAttendeeError } = await supabase
      .from('attendees')
      .update({
        status: status === 'SUCCESS' ? 'CHECKED_IN' : 'FAILED',
        updated_at: new Date().toISOString()
      })
      .eq('id', printJob.attendee_id);

    if (updateAttendeeError) {
      logger.error('Failed to update attendee:', updateAttendeeError);
    }

    // Get attendee for response
    const { data: attendee } = await supabase
      .from('attendees')
      .select()
      .eq('id', printJob.attendee_id)
      .single();

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        attendee_id: printJob.attendee_id,
        print_job_id: printJob.id,
        action: status === 'SUCCESS' ? 'PRINT_SUCCESS' : 'PRINT_FAILED',
        description: status === 'SUCCESS' 
          ? 'Badge successfully printed and confirmed'
          : `Badge printing failed: ${printError}`,
        metadata: { webhookStatus: status }
      });

    // Emit Socket.IO event
    if (status === 'SUCCESS') {
      io.emit('checkin:success', {
        attendeeId: printJob.attendee_id,
        attendeeName: attendee?.name,
        printJobId,
        completedAt
      });
      logger.info(`Check-in completed: ${attendee?.name}`);
    } else {
      io.emit('checkin:failed', {
        attendeeId: printJob.attendee_id,
        printJobId,
        error: printError
      });
      logger.warn(`Check-in failed: ${attendee?.name} - ${printError}`);
    }

    res.status(200).json({
      received: true,
      processed: true,
      jobId: printJobId,
      status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED'
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
    // Test Supabase connection
    const { error: dbError } = await supabase
      .from('attendees')
      .select('count')
      .limit(1);
    
    if (dbError) {
      logger.warn('⚠ Supabase connection issue:', dbError);
    } else {
      logger.info('✓ Connected to Supabase');
    }

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
  if (channel) await channel.close();
  if (rabbitmqConnection) await rabbitmqConnection.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
