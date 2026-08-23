# Solstice Events - Frontend

React + Vite frontend for the event check-in kiosk system.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## Pages

- **Check-In** (`/`): QR code scanning and manual entry
- **Dashboard** (`/dashboard`): Real-time statistics
- **Attendees** (`/attendees`): Attendee search and management
- **Print Jobs** (`/print-jobs`): Print job tracking

## Technologies

- React 18
- Vite
- Tailwind CSS
- Socket.IO Client
- Recharts
- html5-qrcode
- Lucide Icons

## Environment Variables

Create `.env.local`:

```
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```
