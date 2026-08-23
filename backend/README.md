# Solstice Events - Backend API

Express.js API server for the event check-in system with Socket.IO real-time updates.

## Setup

```bash
cd backend
npm install
npm run migrate
npm run seed
npm run dev
```

Backend API runs on http://localhost:3000

## Database Setup

```bash
# Run migrations
npm run migrate

# Seed with test data (500 attendees)
npm run seed

# Open Prisma Studio
npm run studio
```

## API Endpoints

### Health Check
```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-08-23T10:30:00Z",
  "services": {
    "database": "connected",
    "rabbitmq": "connected",
    "api": "online"
  }
}
```

### Check-In (Async)
```
POST /api/check-in
Content-Type: application/json

{
  "qrCode": "QR001"
}
```

Response (202 Accepted):
```json
{
  "success": true,
  "message": "Print job created successfully",
  "attendee": {
    "id": "...",
    "name": "Alice Johnson",
    "status": "PENDING_PRINT"
  },
  "printJob": {
    "id": "JOB-...",
    "status": "QUEUED"
  }
}
```

Response (409 Conflict - Duplicate):
```json
{
  "error": "Attendee already checked in"
}
```

### Get Attendees
```
GET /api/attendees?page=1&limit=20&status=NOT_CHECKED_IN&search=alice
```

### Get Attendee
```
GET /api/attendees/:id
```

### Dashboard Stats
```
GET /api/dashboard/stats
```

Response:
```json
{
  "totalRegistered": 500,
  "checkedIn": 327,
  "pendingPrint": 4,
  "failed": 2,
  "remaining": 167
}
```

### Webhook Callback
```
POST /api/webhooks/print-complete
Content-Type: application/json

{
  "printJobId": "JOB-12345",
  "status": "SUCCESS",
  "completedAt": "2026-08-23T10:30:00Z"
}
```

## Environment Variables

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/solstice_events"
BACKEND_PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
RABBITMQ_URL="amqp://guest:guest@localhost:5672"
RABBITMQ_QUEUE_NAME="badge_print_requests"
WEBHOOK_URL="http://backend:3000/api/webhooks/print-complete"
```

## Features

- ✅ Express.js REST API
- ✅ Socket.IO Real-Time Updates
- ✅ Prisma ORM with PostgreSQL
- ✅ RabbitMQ Integration
- ✅ Database Transactions (Duplicate Protection)
- ✅ Webhook Callback System
- ✅ Input Validation (Joi)
- ✅ Logging (Winston)
- ✅ Error Handling
- ✅ Health Check

## Database Schema

### Attendee
- `id` (UUID)
- `name` (String)
- `email` (String, unique)
- `phone` (String)
- `qrCode` (String, unique)
- `status` (Enum: NOT_CHECKED_IN | PENDING_PRINT | CHECKED_IN | FAILED)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### PrintJob
- `id` (UUID)
- `attendeeId` (UUID, FK)
- `status` (Enum: CREATED | QUEUED | PROCESSING | SUCCESS | FAILED | RETRYING)
- `vendorJobId` (String)
- `attemptCount` (Int)
- `errorMessage` (String)
- `queuedAt` (DateTime)
- `processingAt` (DateTime)
- `completedAt` (DateTime)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### ActivityLog
- `id` (UUID)
- `attendeeId` (UUID, FK)
- `printJobId` (UUID, FK)
- `action` (String)
- `description` (String)
- `metadata` (JSON)
- `createdAt` (DateTime)

## Technologies

- Express.js
- Prisma ORM
- PostgreSQL
- RabbitMQ (amqplib)
- Socket.IO
- Winston (logging)
- Joi (validation)
