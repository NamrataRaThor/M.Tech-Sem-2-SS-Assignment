import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from './common/index';
import { Counter, Gauge, register } from 'prom-client';

dotenv.config();

// Initialize Tracing
initTracing('seating-service');

const app = express();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PORT = process.env.PORT || 8083;
const HOLD_TTL_SECONDS = 15 * 60; // 15 minutes

// --- Observability Metrics ---
const seatReservationsTotal = new Counter({
  name: 'seat_reservations_total',
  help: 'Total number of seat reservation attempts',
});

const seatReservationsFailed = new Counter({
  name: 'seat_reservations_failed',
  help: 'Total number of seat reservation conflicts or failures',
});

const activeSeatHolds = new Gauge({
  name: 'active_seat_holds',
  help: 'Current number of active seat holds',
});

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// --- Health & Metrics Endpoints ---
app.get('/health', (req, res) => res.json({ status: 'UP' }));

app.get('/ready', async (req, res) => {
  try {
    // @ts-ignore
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'READY' });
  } catch (error) {
    res.status(503).json({ status: 'NOT_READY' });
  }
});

app.get('/live', (req, res) => res.json({ status: 'LIVE' }));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// --- Integrated Reaper Worker ---
setInterval(async () => {
  try {
    const expiryTime = new Date(Date.now() - HOLD_TTL_SECONDS * 1000);
    // @ts-ignore
    const expiredSeats = await prisma.seat.updateMany({
      where: {
        status: 'HELD',
        updatedAt: { lt: expiryTime },
      },
      data: { status: 'AVAILABLE' },
    });

    if (expiredSeats.count > 0) {
      logger.info({ expiredCount: expiredSeats.count }, 'Reaper worker released expired seat holds');
    }
    
    // @ts-ignore
    const holdCount = await prisma.seat.count({ where: { status: 'HELD' } });
    activeSeatHolds.set(holdCount);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Reaper worker failed');
  }
}, 60000);

// --- API Routes ---
app.get('/api/v1/seats', async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ success: false, error: { message: 'eventId is required' } });

    // @ts-ignore
    const seats = await prisma.seat.findMany({
      where: { eventId: parseInt(eventId as string) },
    });
    
    res.json({ success: true, data: seats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.post('/api/v1/seats/reserve', async (req, res) => {
  const { eventId, seatIds, orderId } = req.body;
  seatReservationsTotal.inc();
  
  try {
    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      // @ts-ignore
      const seats = await tx.seat.findMany({
        where: { 
          id: { in: seatIds }, 
          eventId: parseInt(eventId), 
          status: 'AVAILABLE' 
        },
      });

      if (seats.length !== seatIds.length) {
        seatReservationsFailed.inc();
        throw new Error('One or more seats are no longer available or do not exist');
      }

      // @ts-ignore
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: 'HELD' },
      });

      const pipeline = redis.pipeline();
      for (const id of seatIds) {
        pipeline.setex(`seat_hold:${id}`, HOLD_TTL_SECONDS, orderId);
      }
      await pipeline.exec();
    });

    res.json({ 
      success: true, 
      data: { holdExpiry: new Date(Date.now() + HOLD_TTL_SECONDS * 1000) } 
    });
  } catch (error: any) {
    logger.warn({ error: error.message, seatIds }, 'Seat reservation attempt failed');
    res.status(409).json({ success: false, error: { message: error.message } });
  }
});

app.post('/api/v1/seats/release', async (req, res) => {
  const { seatIds } = req.body;
  try {
    // @ts-ignore
    await prisma.seat.updateMany({
      where: { id: { in: seatIds }, status: 'HELD' },
      data: { status: 'AVAILABLE' },
    });
    
    const pipeline = redis.pipeline();
    for (const id of seatIds) {
      pipeline.del(`seat_hold:${id}`);
    }
    await pipeline.exec();
    
    res.json({ success: true, message: 'Seats released' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

const shutdown = async () => {
  logger.info('Shutting down seating-service gracefully...');
  // @ts-ignore
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(PORT, () => {
  logger.info(`Seating Service running on port ${PORT}`);
});
