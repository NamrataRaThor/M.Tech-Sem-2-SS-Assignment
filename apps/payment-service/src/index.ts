import { PaymentService } from './services/payment.service';
import { idempotencyMiddleware } from './middleware/idempotency';
import { kafkaProducer } from './events/producer';
import { prisma } from './lib/prisma';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from '@eventsphere/common';
import { Counter, register } from 'prom-client';

dotenv.config();

// Initialize Tracing
initTracing('payment-service');

const app = express();
const paymentService = new PaymentService();
const PORT = process.env.PORT || 8084;

// Metrics
const paymentsTotal = new Counter({
  name: 'payments_total',
  help: 'Total number of payments processed',
  labelNames: ['status']
});

const paymentsFailedTotal = new Counter({
  name: 'payments_failed_total',
  help: 'Total number of failed payment attempts',
});

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Health & Metrics
app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.get('/ready', (req, res) => res.json({ status: 'READY' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Payment Routes
app.post('/api/v1/payments/charge', idempotencyMiddleware, async (req, res) => {
  try {
    const { orderId, amount, method } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string;

    const payment = await paymentService.processCharge({
      orderId: parseInt(orderId),
      amount: parseFloat(amount),
      method,
      idempotencyKey,
      correlationId: req.headers['x-correlation-id'] as string
    });

    paymentsTotal.inc({ status: 'success' });
    res.status(201).json({ success: true, data: payment });
  } catch (error: any) {
    paymentsTotal.inc({ status: 'failed' });
    paymentsFailedTotal.inc();
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

app.post('/api/v1/payments/refund', async (req, res) => {
  try {
    const { paymentId, reason } = req.body;
    const payment = await paymentService.processRefund(parseInt(paymentId), reason);
    res.json({ success: true, data: payment });
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

app.get('/api/v1/payments/:id', async (req, res) => {
  try {
    const payment = await new (require('./repositories/payment.repository').PaymentRepository)().findById(parseInt(req.params.id));
    if (!payment) return res.status(404).json({ success: false, error: { message: 'Payment not found' } });
    res.json({ success: true, data: payment });
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
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
