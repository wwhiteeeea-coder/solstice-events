# Solstice Events - Asynchronous Event Check-In Platform

A production-grade conference check-in kiosk system with asynchronous badge printing, real-time updates, and robust duplicate protection.

## Architecture

This is a complete full-stack platform for managing event check-ins at multi-day technology conferences.

### Key Features

- **Asynchronous Badge Printing**: QR code scanned, badge printed later via webhook
- **Real-Time Updates**: Socket.IO for instant UI updates
- **Duplicate Protection**: Five-layer protection against duplicate badges
- **Out-of-Order Event Handling**: Webhooks can arrive in any order
- **Idempotent Operations**: Safe to retry without side effects
- **Production-Ready**: Docker, proper error handling, audit logs

## Project Structure

```
solstice-events/
├── frontend/                    # React + Vite + Tailwind
├── backend/                     # Express.js + Node.js API
├── vendor-printer-simulator/    # RabbitMQ consumer + webhook sender
├── docker/                      # Docker configuration
├── docker-compose.yml           # Service orchestration
└── .env.example                 # Environment template
```

## Technology Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- shadcn/ui
- Socket.IO Client
- html5-qrcode
- Recharts
- Framer Motion

### Backend
- Node.js
- Express.js
- Socket.IO
- Prisma ORM
- PostgreSQL
- RabbitMQ

### DevOps
- Docker
- Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/wwhiteeeea-coder/solstice-events.git
cd solstice-events

# Copy environment
cp .env.example .env

# Start services
docker-compose up -d

# Wait for services
sleep 10 && docker-compose ps
```

## Development Phases

1. **PHASE 1**: Architecture & Planning ✓
2. **PHASE 2**: Project Setup ✓
3. **PHASE 3**: Database Schema (In Progress)
4. **PHASE 4**: Backend Foundation
5. **PHASE 5**: Check-In System
6. **PHASE 6**: RabbitMQ Integration
7. **PHASE 7**: Printer Simulator
8. **PHASE 8**: Webhook System
9. **PHASE 9**: Real-Time System
10. **PHASE 10**: Frontend
11. **PHASE 11**: Analytics
12. **PHASE 12**: Testing
13. **PHASE 13**: Deployment

## System Architecture

```
Staff scans QR
    ↓
React Frontend
    ↓
Express Backend (202 Accepted)
    ↓
PostgreSQL + Prisma
    ↓
RabbitMQ Message Queue
    ↓
Vendor Printer Simulator
    ↓
Simulated Printing
    ↓
Webhook Callback
    ↓
Backend Processes Webhook
    ↓
Socket.IO Event
    ↓
Frontend Auto-Updates
    ↓
✓ CHECKED IN
```

## Documentation

- **ARCHITECTURE.md**: Complete system design and technical details
- **DEVELOPMENT.md**: Step-by-step development setup and troubleshooting
- **backend/README.md**: Backend API documentation
- **frontend/README.md**: Frontend component documentation
- **vendor-printer-simulator/README.md**: Printer simulator details

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health check |
| POST | `/api/check-in` | Scan and check in (202 Accepted) |
| GET | `/api/attendees` | List attendees with filters |
| GET | `/api/attendees/:id` | Get attendee details |
| GET | `/api/dashboard/stats` | Live dashboard statistics |
| POST | `/api/webhooks/print-complete` | Printer callback |

## Testing

See DEVELOPMENT.md for detailed testing instructions:

- Normal check-in flow
- Duplicate scan protection
- Out-of-order webhook handling
- Failed print retries
- Concurrent requests

## License

Proprietary - Solstice Events Co.

## Author

Built with professional architecture for production deployment.
