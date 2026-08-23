# Solstice Events - Backend API (Supabase Edition)

Express.js API server for the event check-in system with Supabase real-time backend.

## Setup

### 1. Create Supabase Project

1. Go to https://supabase.com
2. Sign up / Log in
3. Create a new project
4. Note your project URL and API keys

### 2. Create Database Tables

Go to Supabase Dashboard > SQL Editor and run:

```sql
-- Attendees table
CREATE TABLE attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  qr_code VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'NOT_CHECKED_IN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendees_qr_code ON attendees(qr_code);
CREATE INDEX idx_attendees_status ON attendees(status);
CREATE INDEX idx_attendees_email ON attendees(email);

-- Print jobs table
CREATE TABLE print_jobs (
  id VARCHAR(255) PRIMARY KEY,
  attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
  vendor_job_id VARCHAR(255),
  attempt_count INT DEFAULT 1,
  error_message TEXT,
  queued_at TIMESTAMP,
  processing_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_print_jobs_attendee_id ON print_jobs(attendee_id);
CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_print_jobs_vendor_job_id ON print_jobs(vendor_job_id);

-- Activity logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id UUID REFERENCES attendees(id) ON DELETE SET NULL,
  print_job_id VARCHAR(255) REFERENCES print_jobs(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_attendee_id ON activity_logs(attendee_id);
CREATE INDEX idx_activity_logs_print_job_id ON activity_logs(print_job_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
```

### 3. Seed Test Data

```sql
-- Insert test attendees
INSERT INTO attendees (name, email, phone, qr_code) VALUES
('Alice Johnson', 'alice@example.com', '+1-555-0001', 'QR001'),
('Brian Otieno', 'brian@example.com', '+1-555-0002', 'QR002'),
('Carol Wanjiku', 'carol@example.com', '+1-555-0003', 'QR003');

-- Add more attendees
DO $$
BEGIN
  FOR i IN 4..500 LOOP
    INSERT INTO attendees (name, email, phone, qr_code)
    VALUES (
      'Attendee ' || i,
      'attendee' || i || '@example.com',
      '+1-555-' || LPAD(i::text, 4, '0'),
      'QR' || LPAD(i::text, 3, '0')
    );
  END LOOP;
END $$;
```

### 4. Setup Backend

```bash
cd backend
npm install
```

Create `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BACKEND_PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_QUEUE_NAME=badge_print_requests
WEBHOOK_URL=http://localhost:3000/api/webhooks/print-complete
```

### 5. Start Backend

```bash
npm run dev
```

Backend API runs on http://localhost:3000

## API Endpoints

### Health Check
```
GET /api/health
```

### Check-In (Async)
```
POST /api/check-in
Content-Type: application/json

{"qrCode": "QR001"}
```

Response (202 Accepted):
```json
{
  "success": true,
  "message": "Print job created successfully",
  "attendee": {"id": "...", "name": "Alice Johnson", "status": "PENDING_PRINT"},
  "printJob": {"id": "JOB-...", "status": "QUEUED"}
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

### Webhook
```
POST /api/webhooks/print-complete
{"printJobId": "JOB-abc123", "status": "SUCCESS", "completedAt": "2026-08-23T10:30:00Z"}
```

## Features

- ✅ Express.js REST API
- ✅ Supabase Real-Time Database
- ✅ Socket.IO Real-Time Updates
- ✅ RabbitMQ Integration
- ✅ Duplicate Protection
- ✅ Webhook Idempotency
- ✅ Input Validation (Joi)
- ✅ Logging (Winston)
- ✅ Error Handling

## Technologies

- Express.js
- Supabase
- Socket.IO
- RabbitMQ (amqplib)
- Winston (logging)
- Joi (validation)
