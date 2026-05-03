import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PaymentService } from './services/payment.service';
import { idempotencyMiddleware } from './middleware/idempotency';
import { kafkaProducer } from './events/producer';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from './common/index';
import { Counter, register } from 'prom-client';

dotenv.config({ override: true });

// Initialize Tracing
initTracing('payment-service');

const app = express();
const paymentService = new PaymentService();
const PORT = process.env.PORT || 8084;

// Metrics
const paymentsProcessedTotal = new Counter({
  name: 'payments_processed_total',
  help: 'Total number of payments processed',
  labelNames: ['status', 'method']
});

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Health & Metrics
app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Payment Routes
app.post('/api/v1/payments/charge', idempotencyMiddleware, async (req, res) => {
  try {
    const correlationId = req.headers['x-correlation-id'] as string;
    const result = await paymentService.processPayment(req.body, correlationId);
    
    paymentsProcessedTotal.inc({ status: 'success', method: req.body.method });
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    paymentsProcessedTotal.inc({ status: 'failed', method: req.body.method });
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

app.get('/api/v1/payments/order/:orderId', async (req, res) => {
  try {
    const status = await paymentService.getPaymentStatus(parseInt(req.params.orderId));
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Startup
const start = async () => {
  await kafkaProducer.connect();
  app.listen(PORT, () => {
    logger.info(`Payment Service running on port ${PORT}`);
  });
};

const shutdown = async () => {
  logger.info('Shutting down payment-service gracefully...');
  await kafkaProducer.disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
