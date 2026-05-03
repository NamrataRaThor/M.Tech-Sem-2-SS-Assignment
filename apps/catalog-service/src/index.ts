import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { logger, httpLogger, correlationIdMiddleware } from './common/index';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8082;

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Health Check
app.get('/health', (req, res) => res.json({ status: 'UP' }));

// Simplified Get Events - Matches Gateway Rewrite
app.get('/api/v1/events', async (req, res) => {
  try {
    const { city, category, status } = req.query;
    
    // Build simple filter
    const where: any = {};
    if (city) where.city = city;
    if (category) where.type = category; // Field is 'type' in schema
    if (status) where.status = status;

    // @ts-ignore
    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' } // Fixed: Use startTime instead of date
    });
    res.json({ success: true, data: events });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch events');
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Simplified Get Event by ID
app.get('/api/v1/events/:id', async (req, res) => {
  try {
    // @ts-ignore
    const event = await prisma.event.findUnique({
      where: { id: parseInt(req.params.id) }
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
