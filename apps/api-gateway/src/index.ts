import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { register } from 'prom-client';

dotenv.config({ override: true });
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from './common/index';

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
// @ts-ignore
app.use(limiter);

// Service URLs (Internal K8s DNS or Localhost)
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:8081',
  catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:8082',
  seating: process.env.SEATING_SERVICE_URL || 'http://localhost:8083',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:8085',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:8084',
  ticket: process.env.TICKET_SERVICE_URL || 'http://localhost:8086',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8087'
};

// --- Proxy Routes ---

// 1. Identity Service (Public)
// @ts-ignore
app.use('/api/v1/auth', createProxyMiddleware({
  target: services.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/auth': '/api/v1/auth' }
}));

// 2. Catalog Service (Read: Public, Write: Protected)
app.use('/api/v1/catalog', (req: any, res: any, next: any) => {
  if (req.method === 'GET') return next();
  return authMiddleware(req, res, next);
}, 
// @ts-ignore
createProxyMiddleware({
  target: services.catalog,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/catalog': '/api/v1' }
}));

// 3. Seating Service (Public GET, Protected POST)
app.use('/api/v1/seats', (req: any, res: any, next: any) => {
  if (req.method === 'GET') return next();
  return authMiddleware(req, res, next);
}, 
// @ts-ignore
createProxyMiddleware({
  target: services.seating,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/seats': '/api/v1/seats' }
}));

// 4. Order Service (Protected)
// @ts-ignore
app.use('/api/v1/orders', authMiddleware, createProxyMiddleware({
  target: services.order,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/orders': '/api/v1/orders' }
}));

// 5. Payment Service (Protected)
// @ts-ignore
app.use('/api/v1/payments', authMiddleware, createProxyMiddleware({
  target: services.payment,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/payments': '/api/v1/payments' }
}));

// 6. Ticket Service (Protected)
// @ts-ignore
app.use('/api/v1/tickets', authMiddleware, createProxyMiddleware({
  target: services.ticket,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/tickets': '/api/v1/tickets' }
}));

// 7. Notification Service (Protected)
// @ts-ignore
app.use('/api/v1/notifications', authMiddleware, createProxyMiddleware({
  target: services.notification,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/notifications': '/api/v1/notifications' }
}));

// Health Check
app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'api-gateway' }));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});
