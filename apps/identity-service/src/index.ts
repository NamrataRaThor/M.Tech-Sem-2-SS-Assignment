import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger, httpLogger, correlationIdMiddleware, initTracing } from './common/index';
import { collectDefaultMetrics } from 'prom-client';

dotenv.config();

// Initialize Tracing
initTracing('identity-service');

// Default Metrics
collectDefaultMetrics({ prefix: 'identity_' });

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(express.json());
app.use(cors());
app.use(correlationIdMiddleware);
app.use(httpLogger);

// Health endpoints
app.get('/health', (req, res) => res.json({ status: 'UP' }));
app.get('/ready', (req, res) => res.json({ status: 'READY' }));
app.get('/live', (req, res) => res.json({ status: 'LIVE' }));

app.get('/metrics', async (req, res) => {
  const { register } = require('prom-client');
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Auth Routes
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, city } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    
    const user = // @ts-ignore
    // @ts-ignore
    await prisma.user.create({
      data: { name, email, passwordHash, phone, city },
    });
    
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.status(201).json({ success: true, data: userWithoutPassword });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Registration failed');
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = // @ts-ignore
    // @ts-ignore
    await prisma.user.findUnique({ where: { email } });
    
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ success: true, data: { token, userId: user.id } });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Login failed');
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
});

app.listen(PORT, () => {
  logger.info(`Identity Service running on port ${PORT}`);
});
