import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TicketService } from './services/ticket.service';
import { TicketRepository } from './repositories/ticket.repository';
import { prisma } from './lib/prisma';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from '@eventsphere/common';
import { Counter, register } from 'prom-client';

dotenv.config();

// Initialize Tracing
initTracing('ticket-service');

const app = express();
const ticketService = new TicketService();
const ticketRepo = new TicketRepository();
const PORT = process.env.PORT || 8086;

// Metrics
export const ticketsGeneratedTotal = new Counter({
  name: 'tickets_generated_total',
  help: 'Total number of tickets generated',
  labelNames: ['eventId']
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

// Ticket Routes
app.get('/api/v1/tickets/:id', async (req, res) => {
  try {
    const ticket = await ticketRepo.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    res.json({ success: true, data: ticket });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.get('/api/v1/tickets/order/:orderId', async (req, res) => {
  try {
    const tickets = await ticketRepo.findByOrderId(parseInt(req.params.orderId));
    res.json({ success: true, data: tickets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Startup
const start = async () => {
  await ticketService.startListening();
  app.listen(PORT, () => {
    logger.info(`Ticket Service running on port ${PORT}`);
  });
};

const shutdown = async () => {
  logger.info('Shutting down ticket-service gracefully...');
  await ticketService.shutdown();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
