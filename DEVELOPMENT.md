# Development Guide

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

# Printer Simulator
cd vendor-printer-simulator
npm install
cd ..
```

### 2. Setup Database

```bash
# Start PostgreSQL (via Docker)
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
sleep 5

# Run migrations
cd backend
npm run migrate
npm run seed
cd ..
```

### 3. Start RabbitMQ

```bash
# Start RabbitMQ (via Docker)
docker-compose up -d rabbitmq
```

### 4. Start All Services

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Printer Simulator
cd vendor-printer-simulator
npm run dev

# Terminal 3: Frontend
cd frontend
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- RabbitMQ Management: http://localhost:15672 (guest/guest)
- PostgreSQL: localhost:5432 (postgres/postgres)

## Using Docker Compose

### Start All Services

```bash
# Build and start everything
docker-compose up --build
```

### Stop All Services

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f printer-simulator
```

### Reset Database

```bash
# Stop services
docker-compose down -v

# Start again (fresh database)
docker-compose up --build
```

## API Testing

### Check-In

```bash
curl -X POST http://localhost:3000/api/check-in \
  -H "Content-Type: application/json" \
  -d '{"qrCode": "QR001"}'
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

### Dashboard Stats

```bash
curl http://localhost:3000/api/dashboard/stats
```

### Get Attendees

```bash
curl http://localhost:3000/api/attendees?page=1&limit=20
```

## Environment Variables

Create `.env` file in root:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/solstice_events"

# Backend
BACKEND_PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"

# RabbitMQ
RABBITMQ_URL="amqp://guest:guest@localhost:5672"
RABBITMQ_QUEUE_NAME="badge_print_requests"

# Frontend
VITE_API_URL="http://localhost:3000/api"
VITE_SOCKET_URL="http://localhost:3000"

# Webhook
WEBHOOK_URL="http://localhost:3000/api/webhooks/print-complete"
WEBHOOK_SECRET="dev-webhook-secret"
```

## Troubleshooting

### PostgreSQL Connection Error

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### RabbitMQ Connection Error

```bash
# Check if RabbitMQ is running
docker ps | grep rabbitmq

# Restart RabbitMQ
docker-compose restart rabbitmq

# Check RabbitMQ logs
docker-compose logs rabbitmq
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Clear All Containers and Volumes

```bash
# Remove all containers and volumes
docker-compose down -v

# Remove all images
docker-compose down -v --rmi all

# Restart fresh
docker-compose up --build
```

## Code Organization

```
solstice-events/
├── backend/
│   ├── src/
│   │   ├── server.js          # Main Express server
│   │   └── utils/
│   │       ├── logger.js      # Winston logger
│   │       └── validators.js  # Input validation
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.js            # Test data
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable components
│   │   ├── context/           # React context
│   │   ├── services/          # API clients
│   │   ├── App.jsx            # Main app
│   │   └── main.jsx           # Entry point
│   └── package.json
├── vendor-printer-simulator/
│   ├── src/
│   │   └── consumer.js        # RabbitMQ consumer
│   └── package.json
└── docker-compose.yml
```
