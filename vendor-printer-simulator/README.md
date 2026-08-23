# Solstice Events - Vendor Printer Simulator

Simulates the vendor printer service that consumes print jobs from RabbitMQ and sends webhook callbacks.

## Setup

```bash
cd vendor-printer-simulator
npm install
npm run dev
```

## How It Works

1. Connects to RabbitMQ
2. Listens on `badge_print_requests` queue
3. Consumes print job messages
4. Simulates printing with random delays (2-8 seconds)
5. Randomly simulates failures (10% chance)
6. Sends webhook callback to backend
7. Completes jobs in random order (out-of-order handling)

## Environment Variables

Create `.env`:

```
RABBITMQ_URL="amqp://guest:guest@localhost:5672"
RABBITMQ_QUEUE_NAME="badge_print_requests"
WEBHOOK_URL="http://localhost:3000/api/webhooks/print-complete"
```

## Features

- **Asynchronous Processing**: Jobs are processed one at a time
- **Variable Delays**: Simulates real printer behavior with 2-8 second delays
- **Random Failures**: 10% chance of simulated printer failure
- **Out-of-Order Completion**: Jobs complete in random order
- **Webhook Integration**: Sends results back to backend via webhook
- **Robust Error Handling**: Requeues failed messages
- **Message Acknowledgment**: Ensures reliable delivery

## Example Output

```
📧 Received print job: JOB-abc123 for Alice Johnson
⏳ Processing job JOB-abc123 - simulating 4000ms print time
✓ Successfully printed job JOB-abc123 for Alice Johnson
✓ Success webhook sent for JOB-abc123: 200
✓ Message acknowledged for JOB-abc123
```

## Testing Out-of-Order Completion

The simulator intentionally completes jobs in random order to test the backend's ability to handle out-of-order webhooks. This verifies that the system correctly matches webhook callbacks to print jobs using unique job IDs.
