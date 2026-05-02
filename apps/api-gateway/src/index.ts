import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from '@eventsphere/common';

dotenv.config();

// Initialize Tracing
initTracing('api-gateway');

const app = express();
const PORT = process.env.PORT || 8080;

// Security & Observability
app.use(helmet());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Service URLs (Internal K8s DNS or Localhost)
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://identity-service:8081',
  catalog: process.env.CATALOG_SERVICE_URL || 'http://catalog-service:8082',
  seating: process.env.SEATING_SERVICE_URL || 'http://seating-service:8083',
  order: process.env.ORDER_SERVICE_URL || 'http://order-service:8085',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:8084',
  ticket: process.env.TICKET_SERVICE_URL || 'http://ticket-service:8086',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:8087'
};

// --- Proxy Routes ---

// 1. Identity Service (Public)
app.use('/api/v1/auth', createProxyMiddleware({
  target: services.auth,
  changeOrigin: true
}));

// 2. Catalog Service (Read: Public, Write: Protected)
app.use('/api/v1/catalog', (req, res, next) => {
  if (req.method === 'GET') return next();
  return authMiddleware(req, res, next);
}, createProxyMiddleware({
  target: services.catalog,
  changeOrigin: true
}));

// 3. Seating Service (Protected)
app.use('/api/v1/seats', authMiddleware, createProxyMiddleware({
  target: services.seating,
  changeOrigin: true
}));

// 4. Order Service (Protected)
app.use('/api/v1/orders', authMiddleware, createProxyMiddleware({
  target: services.order,
  changeOrigin: true
}));

// 5. Payment Service (Protected)
app.use('/api/v1/payments', authMiddleware, createProxyMiddleware({
  target: services.payment,
  changeOrigin: true
}));

// 6. Ticket Service (Protected)
app.use('/api/v1/tickets', authMiddleware, createProxyMiddleware({
  target: services.ticket,
  changeOrigin: true
}));

// 7. Notification Service (Protected)
app.use('/api/v1/notifications', authMiddleware, createProxyMiddleware({
  target: services.notification,
  changeOrigin: true
}));

// Health Check
app.get('/health', (req, res) => res.json({ status: 'UP', service: 'api-gateway' }));

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});
