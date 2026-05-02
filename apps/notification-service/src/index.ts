import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { NotificationService } from './services/notification.service';
import { prisma } from './lib/prisma';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from '@eventsphere/common';
import { Counter, register } from 'prom-client';

dotenv.config();

// Initialize Tracing
initTracing('notification-service');

const app = express();
const notificationService = new NotificationService();
const PORT = process.env.PORT || 8087;

// Metrics
export const notificationsSentTotal = new Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications mocked',
  labelNames: ['type', 'channel']
});

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Health & Metrics
app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'READY' });
  } catch (error) {
    res.status(503).json({ status: 'NOT_READY' });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// History Routes
app.get('/api/v1/notifications/user/:userId', async (req, res) => {
  try {
    const logs = await prisma.notificationLog.findMany({
      where: { userId: parseInt(req.params.userId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Startup
const start = async () => {
  await notificationService.startListening();
  app.listen(PORT, () => {
    logger.info(`Notification Service running on port ${PORT}`);
  });
};

const shutdown = async () => {
  logger.info('Shutting down notification-service gracefully...');
  await notificationService.shutdown();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
