import amqp from 'amqplib';
import axios from 'axios';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'printer.log' })
  ]
});

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = process.env.RABBITMQ_QUEUE_NAME || 'badge_print_requests';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/print-complete';

let connection = null;
let channel = null;

// Simulated print delays (in milliseconds)
const PRINT_DELAYS = [2000, 3000, 4000, 5000, 6000, 7000, 8000];

function getRandomDelay() {
  return PRINT_DELAYS[Math.floor(Math.random() * PRINT_DELAYS.length)];
}

function shouldSimulateFailure() {
  // 10% chance of failure
  return Math.random() < 0.1;
}

async function processPrintJob(message) {
  try {
    const data = JSON.parse(message.content.toString());
    const { printJobId, attendeeId, attendeeName, qrCode, attemptNumber, timestamp } = data;

    logger.info(`📧 Received print job: ${printJobId} for ${attendeeName}`);

    // Simulate variable print delay
    const delay = getRandomDelay();
    logger.info(`⏳ Processing job ${printJobId} - simulating ${delay}ms print time`);
    
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate success or failure
    const willFail = shouldSimulateFailure();
    
    if (willFail) {
      logger.warn(`❌ Simulated failure for job ${printJobId}`);
      
      // Send failure webhook
      try {
        const response = await axios.post(WEBHOOK_URL, {
          printJobId,
          status: 'FAILED',
          error: 'Simulated printer error: Paper jam detected',
          completedAt: new Date().toISOString()
        });
        logger.info(`✓ Failure webhook sent for ${printJobId}: ${response.status}`);
      } catch (error) {
        logger.error(`✗ Failed to send failure webhook for ${printJobId}:`, error.message);
      }
    } else {
      logger.info(`✓ Successfully printed job ${printJobId} for ${attendeeName}`);
      
      // Send success webhook
      try {
        const response = await axios.post(WEBHOOK_URL, {
          printJobId,
          status: 'SUCCESS',
          completedAt: new Date().toISOString()
        });
        logger.info(`✓ Success webhook sent for ${printJobId}: ${response.status}`);
      } catch (error) {
        logger.error(`✗ Failed to send success webhook for ${printJobId}:`, error.message);
      }
    }

    // Acknowledge message
    channel.ack(message);
    logger.info(`✓ Message acknowledged for ${printJobId}`);
  } catch (error) {
    logger.error('Error processing print job:', error);
    // Negative acknowledge - requeue message
    channel.nack(message, false, true);
  }
}

async function setupConsumer() {
  try {
    logger.info('🔌 Connecting to RabbitMQ...');
    connection = await amqp.connect(RABBITMQ_URL);
    
    logger.info('📬 Creating channel...');
    channel = await connection.createChannel();

    // Assert queue
    logger.info(`📋 Asserting queue: ${QUEUE_NAME}`);
    await channel.assertExchange('badge_exchange', 'direct', { durable: true });
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.bindQueue(QUEUE_NAME, 'badge_exchange', 'print.request');

    // Set prefetch to 1 (process one job at a time)
    await channel.prefetch(1);

    logger.info(`✓ Consumer ready. Listening on queue: ${QUEUE_NAME}`);
    logger.info(`✓ Webhook URL: ${WEBHOOK_URL}`);
    logger.info('\n🖨️  Printer Simulator Started');
    logger.info('=' .repeat(50));

    // Consume messages
    await channel.consume(QUEUE_NAME, processPrintJob, { noAck: false });
  } catch (error) {
    logger.error('Consumer setup failed:', error);
    logger.info('Retrying connection in 5 seconds...');
    setTimeout(setupConsumer, 5000);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down printer simulator...');
  if (channel) await channel.close();
  if (connection) await connection.close();
  logger.info('✓ Closed');
  process.exit(0);
});

setupConsumer();
