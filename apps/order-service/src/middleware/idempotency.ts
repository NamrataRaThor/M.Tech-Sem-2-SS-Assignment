import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '@eventsphere/common';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['idempotency-key'] as string;

  if (!key) {
    return next();
  }

  try {
    const record = await prisma.idempotencyRecord.findUnique({
      where: { key },
    });

    if (record && new Date() < new Date(record.expiresAt)) {
      logger.info({ idempotencyKey: key }, 'Idempotency hit: returning cached response');
      return res.status(record.responseStatus).json(record.responseBody);
    }
  } catch (error) {
    logger.error({ error, idempotencyKey: key }, 'Error checking idempotency');
  }

  const originalJson = res.json;
  res.json = function (body: any) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      prisma.idempotencyRecord.upsert({
        where: { key },
        update: {
          responseStatus: res.statusCode,
          responseBody: body,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        create: {
          key,
          responseStatus: res.statusCode,
          responseBody: body,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }).catch(err => logger.error({ err }, 'Failed to save idempotency record'));
    }
    return originalJson.call(this, body);
  };

  next();
};
