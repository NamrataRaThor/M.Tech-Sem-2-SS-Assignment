import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { register } from 'prom-client';

dotenv.config({ override: true });
import { PrismaClient } from '@prisma/client';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from './common/index';

// Initialize Tracing
initTracing('seating-service');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8083;

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Health endpoints
app.get('/health', (req, res) => res.json({ status: 'UP' }));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// --- Seating Routes ---

// GET seats for an event
app.get('/api/v1/seats/:eventId', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    // @ts-ignore
    const seats = await prisma.seat.findMany({
      where: { eventId },
      orderBy: { label: 'asc' }
    });
    res.json({ success: true, data: seats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.post('/api/v1/seats/reserve', async (req, res) => {
  try {
    const { eventId, seatIds, orderId } = req.body;
    
    // Check if seats are available
    // @ts-ignore
    const availableSeats = await prisma.seat.findMany({
      where: {
        id: { in: seatIds },
        eventId,
        status: 'AVAILABLE'
      }
    });

    if (availableSeats.length !== seatIds.length) {
      return res.status(409).json({ success: false, error: { message: 'Some seats are already taken' } });
    }

    // Mark as HELD
    // @ts-ignore
    await prisma.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: 'HELD' }
    });

    // Fetch the updated seats to return them
    // @ts-ignore
    const reservedSeats = await prisma.seat.findMany({
      where: { id: { in: seatIds } }
    });

    res.json({ 
      success: true, 
      message: 'Seats held successfully',
      data: reservedSeats 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.post('/api/v1/seats/release', async (req, res) => {
  try {
    const { seatIds } = req.body;
    // @ts-ignore
    await prisma.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: 'AVAILABLE' }
    });
    res.json({ success: true, message: 'Seats released successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.listen(PORT, () => {
  logger.info(`Seating Service running on port ${PORT}`);
});
