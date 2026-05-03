import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { register } from 'prom-client';

dotenv.config();
import { PrismaClient } from '@prisma/client';
import { logger, httpLogger, correlationIdMiddleware } from './common/index';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8082;

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Health endpoints
app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.get('/ready', (req, res) => res.json({ status: 'READY' }));
app.get('/live', (req, res) => res.json({ status: 'LIVE' }));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Catalog Routes
app.get('/api/v1/events', async (req, res) => {
  try {
    const { city, type, status } = req.query;
    // @ts-ignore
    const events = await prisma.event.findMany({
      where: {
        city: city as string,
        type: type as string,
        status: status as any,
      },
      include: { venue: true },
    });
    res.json({ success: true, data: events });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch events');
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

app.get('/api/v1/events/:id', async (req, res) => {
  try {
    // @ts-ignore
    const event = await prisma.event.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { venue: true },
    });
    if (!event) return res.status(404).json({ success: false, error: { message: 'Event not found' } });
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.listen(PORT, () => {
  logger.info(`Catalog Service running on port ${PORT}`);
});
