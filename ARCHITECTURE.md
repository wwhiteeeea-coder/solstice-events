# Solstice Events - Complete Architecture Documentation

## System Overview

Solstice Events is an asynchronous event check-in platform designed for multi-day technology conferences. When an attendee's QR code is scanned:

1. Backend validates immediately (returns 202 Accepted)
2. Print job is queued to RabbitMQ
3. Staff can scan next attendee immediately
4. Printer processes badge asynchronously (2-8 seconds)
5. Printer sends webhook confirmation
6. Backend updates attendee status
7. Frontend auto-updates via Socket.IO

## Architecture Diagram

```
┌──────────────────────┐
│     EVENT STAFF      │
│  (Kiosk Operator)    │
└──────────┬───────────┘
           │ Scans QR Code
           ▼
┌──────────────────────────────────┐
│   REACT FRONTEND (Kiosk)         │
│  - QR Scanner (html5-qrcode)     │
│  - Manual QR Entry               │
│  - Real-time Status              │
│  - Socket.IO Connection          │
└──────────┬──────────────────────┘
           │ POST /api/check-in
           ▼
┌──────────────────────────────────┐
│   EXPRESS BACKEND API            │
│  - Validate Attendee             │
│  - Check Duplicate Status        │
│  - Create Print Job              │
│  - Publish to RabbitMQ           │
│  - Return 202 Accepted           │
└──────┬──────────────────┬────────┘
       │                  │
       ▼                  ▼
┌──────────────────┐  ┌────────────────────┐
│   POSTGRESQL     │  │  RABBITMQ QUEUE    │
│   + PRISMA       │  │  (badge_print_     │
│                  │  │   requests)        │
│  - Attendee      │  │                    │
│  - PrintJob      │  │  - Durable Queue   │
│  - ActivityLog   │  │  - Persistent Msgs │
└──────────────────┘  └────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  VENDOR PRINTER      │
                    │  SIMULATOR           │
                    │                      │
                    │  - Consume Message   │
                    │  - Simulate Delay    │
                    │  - Process Badge     │
                    │  - Send Webhook      │
                    └────────┬─────────────┘
                             │ (2-8 sec delay)
                             ▼
                    ┌──────────────────────┐
                    │  WEBHOOK CALLBACK    │
                    │  POST /webhooks/     │
                    │  print-complete      │
                    └────────┬─────────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │  PROCESS WEBHOOK     │
                    │  - Validate Payload  │
                    │  - Find Print Job    │
                    │  - Update Status     │
                    │  - Emit Socket Event │
                    └────────┬─────────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │  SOCKET.IO EVENT     │
                    │  checkin:success     │
                    └────────┬─────────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │  REACT FRONTEND      │
                    │  AUTO-UPDATE UI      │
                    │  ✓ CHECKED IN        │
                    └──────────────────────┘
```

## Five Layers of Duplicate Protection

### Layer 1: Frontend Protection
Disable the check-in button during processing to prevent double-clicks.

### Layer 2: Database Transaction
Use SQL transactions to ensure only one print job is created atomically.

### Layer 3: Attendee Status Check
Reject check-in if attendee is not in `NOT_CHECKED_IN` state.

### Layer 4: Message Deduplication
RabbitMQ messages include unique `printJobId`. Consumer skips if job already processed.

### Layer 5: Webhook Idempotency
Detect and ignore duplicate webhook callbacks.

## Out-of-Order Webhook Handling

Every print job has a globally unique UUID. Webhooks contain the job ID.

Backend finds the correct job regardless of arrival order using the `printJobId` field.

## Idempotency Implementation

Every operation is safe to retry:

- Same check-in request = same result (or rejection)
- Same RabbitMQ message = skipped
- Same webhook = no change

## Database Schema

### Attendee Table

```sql
CREATE TABLE attendees (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  qr_code VARCHAR(100) UNIQUE NOT NULL,
  status AttendeeStatus DEFAULT 'NOT_CHECKED_IN',
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  INDEX idx_qr_code (qr_code),
  INDEX idx_status (status),
  INDEX idx_email (email)
);
```

Status values:
- `NOT_CHECKED_IN`: Initial state
- `PENDING_PRINT`: Active print job in progress
- `CHECKED_IN`: Successfully checked in
- `FAILED`: Print job failed

### PrintJob Table

```sql
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY,
  attendee_id UUID NOT NULL REFERENCES attendees(id),
  status PrintJobStatus DEFAULT 'CREATED',
  vendor_job_id VARCHAR(255),
  attempt_count INT DEFAULT 1,
  error_message TEXT,
  queued_at TIMESTAMP,
  processing_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  INDEX idx_attendee_id (attendee_id),
  INDEX idx_status (status),
  INDEX idx_vendor_job_id (vendor_job_id)
);
```

Status values:
- `CREATED`: Just created, not yet queued
- `QUEUED`: Published to RabbitMQ
- `PROCESSING`: Printer is working
- `SUCCESS`: Completed successfully
- `FAILED`: Print failed
- `RETRYING`: Retry attempt in progress

### ActivityLog Table

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  attendee_id UUID REFERENCES attendees(id),
  print_job_id UUID REFERENCES print_jobs(id),
  action VARCHAR(100) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP,
  
  INDEX idx_attendee_id (attendee_id),
  INDEX idx_print_job_id (print_job_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);
```

Activity actions:
- `QR_SCANNED`
- `CHECKIN_REQUESTED`
- `DUPLICATE_SCAN_BLOCKED`
- `PRINT_JOB_CREATED`
- `PRINT_JOB_QUEUED`
- `PRINT_STARTED`
- `PRINT_SUCCESS`
- `PRINT_FAILED`
- `WEBHOOK_RECEIVED`
- `WEBHOOK_DUPLICATE`
- `ATTENDEE_CHECKED_IN`
- `PRINT_RETRY_REQUESTED`

## API Endpoints

### Health Check
```
GET /api/health

Response:
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

### Check-In
```
POST /api/check-in

Request:
{
  "qrCode": "QR001"
}

Response (202 Accepted):
{
  "success": true,
  "message": "Print job created successfully",
  "attendee": {
    "id": "ATT-xyz",
    "name": "Alice Johnson",
    "status": "PENDING_PRINT"
  },
  "printJob": {
    "id": "JOB-abc123",
    "status": "QUEUED"
  }
}

Response (409 Conflict - Duplicate):
{
  "error": "Attendee already checked in"
}
```

### Get Attendees
```
GET /api/attendees?page=1&limit=20&status=NOT_CHECKED_IN&search=alice

Response:
{
  "data": [
    {
      "id": "ATT-xyz",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "qrCode": "QR001",
      "status": "NOT_CHECKED_IN",
      "createdAt": "2026-08-23T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "pages": 25
  }
}
```

### Dashboard Stats
```
GET /api/dashboard/stats

Response:
{
  "totalRegistered": 500,
  "checkedIn": 327,
  "pendingPrint": 4,
  "failed": 2,
  "remaining": 167
}
```

### Webhook
```
POST /api/webhooks/print-complete

Request:
{
  "printJobId": "JOB-abc123",
  "status": "SUCCESS",
  "completedAt": "2026-08-23T10:30:05Z"
}

Response (200 OK):
{
  "received": true,
  "processed": true,
  "jobId": "JOB-abc123",
  "status": "SUCCESS"
}
```

## RabbitMQ Configuration

### Queue Setup
```javascript
Exchange: badge_exchange (direct)
Queue: badge_print_requests (durable)
Routing Key: print.request
```

### Message Format
```json
{
  "printJobId": "JOB-abc123def456xyz789",
  "attendeeId": "ATT-xyz789",
  "attendeeName": "Alice Johnson",
  "qrCode": "QR001",
  "attemptNumber": 1,
  "timestamp": "2026-08-23T10:30:00Z"
}
```

## Socket.IO Events

### Events Emitted by Backend

```javascript
socket.emit('checkin:submitted', { attendeeId, attendeeName, printJobId });
socket.emit('checkin:queued', { printJobId });
socket.emit('checkin:processing', { printJobId });
socket.emit('checkin:success', { attendeeId, attendeeName, printJobId, completedAt });
socket.emit('checkin:failed', { attendeeId, printJobId, error });
socket.emit('checkin:duplicate', { attendeeId, currentStatus });
socket.emit('dashboard:update', { totalRegistered, checkedIn, pendingPrint, failed, remaining });
```

## Security Considerations

- **Input Validation**: All endpoints validate input
- **Environment Variables**: Never hardcode credentials
- **Database Security**: Parameterized queries via Prisma
- **API Security**: CORS properly configured
- **Webhook Verification**: Signature verification (planned)
- **Error Handling**: Secure, non-leaking error messages

## Deployment Architecture

### Development (Local Docker)
```
Host Machine
├── Frontend (npm run dev)
├── Backend (npm run dev)
├── Vendor Simulator (npm run dev)
├── PostgreSQL (Docker)
└── RabbitMQ (Docker)
```

### Production (Cloud)
```
Load Balancer
├── API Instances (3+)
├── PostgreSQL (Managed)
├── RabbitMQ (Managed or Cluster)
├── Frontend (CDN)
└── Monitoring (CloudWatch/Datadog)
```

## Monitoring & Observability

### Metrics to Track
- QR scans per minute
- Check-in success rate
- Print job latency (p50, p95, p99)
- Failed print jobs
- Webhook processing time
- Queue depth
- Database connection pool usage
- API response times

### Logging
- All important actions logged with timestamp
- Request IDs for tracing
- Error stack traces
- Webhook processing logs

---

This architecture ensures reliable, scalable, asynchronous event check-ins with strong duplicate protection and real-time updates.
