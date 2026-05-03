import pino from 'pino';
import { Request, Response, NextFunction } from 'express';
import { trace, context } from '@opentelemetry/api';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    // Automatically inject TraceID and SpanID from OpenTelemetry context
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      const { traceId, spanId } = activeSpan.spanContext();
      return {
        traceId,
        spanId,
        service: process.env.SERVICE_NAME || 'unknown-service',
      };
    }
    return {
      service: process.env.SERVICE_NAME || 'unknown-service',
    };
  },
});

export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const correlationId = (req.headers['x-correlation-id'] || 'no-id') as string;
  const requestId = (req.headers['x-request-id'] || 'no-id') as string;

  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info({
      correlationId,
      requestId,
      eventType: 'HTTP_REQUEST',
      latency: `${duration}ms`,
      statusCode: res.statusCode,
      method: req.method,
      path: req.path,
      userId: req.headers['x-user-id'] || 'anonymous',
    }, `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
};

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] || `corr-${Date.now()}`;
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
};
