import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

const app = express();
const port = process.env.PORT || 3001;

const bookings = [];

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/bookings', (_, res) => {
  res.json({ bookings });
});

app.post('/api/bookings', (req, res) => {
  const { customerName, unitSize } = req.body ?? {};

  if (!customerName || !unitSize) {
    res.status(400).json({ error: 'customerName and unitSize are required' });
    return;
  }

  const booking = {
    id: crypto.randomUUID(),
    customerName,
    unitSize,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  bookings.unshift(booking);
  res.status(201).json({ booking });
});

export function startServer() {
  return app.listen(port, () => {
    console.log(`HSS API listening on http://localhost:${port}`);
  });
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export default app;
