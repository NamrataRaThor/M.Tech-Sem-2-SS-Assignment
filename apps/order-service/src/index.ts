import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import { OrderService } from './services/order.service';
import { idempotencyMiddleware } from './middleware/idempotency';
import { kafkaProducer } from './events/producer';
import { prisma } from './lib/prisma';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from './common/index';
import { Counter, Histogram, register } from 'prom-client';
import { DomainEvent } from "./types/events";
import { v4 as uuidv4 } from "uuid";

// Initialize Tracing
initTracing('order-service');

const app = express();
const orderService = new OrderService();
const PORT = process.env.PORT || 8085;

// Metrics
const ordersTotal = new Counter({
  name: 'orders_total',
  help: 'Total number of orders processed',
  labelNames: ['status']
});

export const sagaRollbacksTotal = new Counter({
  name: 'order_saga_rollbacks_total',
  help: 'Total number of saga rollbacks performed',
  labelNames: ['reason']
});

export const sagaDuration = new Histogram({
  name: 'order_saga_duration_seconds',
  help: 'Time taken to complete the full order saga',
  buckets: [1, 2, 5, 10, 30]
});

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Health & Metrics
app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.get('/ready', async (req, res) => {
  try {
    // @ts-ignore
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

// Order Routes
app.post('/api/v1/orders', idempotencyMiddleware, async (req, res) => {
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    
    // Fix: Extract userId from header (sent by API Gateway)
    const userId = parseInt(req.headers['x-user-id'] as string || '1');
    
    // Fix: Map paymentMethodId from body to paymentMethod
    const orderData = {
      userId,
      eventId: req.body.eventId,
      seatIds: req.body.seatIds,
      paymentMethod: req.body.paymentMethodId || req.body.paymentMethod || 'pm_card_visa'
    };

    const confirmedOrder = await orderService.placeOrder(orderData, correlationId);
    
    // 5. Emit Confirmed Event
    await kafkaProducer.emit(DomainEvent.ORDER_CONFIRMED, {
      eventId: uuidv4(),
      eventType: DomainEvent.ORDER_CONFIRMED,
      metadata: {
        correlationId,
        timestamp: new Date().toISOString(),
      },
      payload: { 
        orderId: confirmedOrder.id, 
        userId: confirmedOrder.userId,
        seats: confirmedOrder.items.map((i: any) => i.seatId)
      }
    });

    ordersTotal.inc({ status: 'success' });
    res.status(201).json({ success: true, data: confirmedOrder });
  } catch (error: any) {
    ordersTotal.inc({ status: 'failed' });
    logger.error({ error: error.message }, 'Order creation failed at controller');
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

app.get('/api/v1/orders/:id', async (req, res) => {
  try {
    const order = await new (require('./repositories/order.repository').OrderRepository)().findById(parseInt(req.params.id));
    if (!order) return res.status(404).json({ success: false, error: { message: 'Order not found' } });
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

app.post('/api/v1/orders/:id/cancel', async (req, res) => {
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    await orderService.cancelOrder(parseInt(req.params.id), correlationId);
    res.json({ success: true, message: 'Order cancelled' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

// Startup
const start = async () => {
  await kafkaProducer.connect();
  app.listen(PORT, () => {
    logger.info(`Order Service running on port ${PORT}`);
  });
};

const shutdown = async () => {
  logger.info('Shutting down order-service gracefully...');
  await kafkaProducer.disconnect();
  // @ts-ignore
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
