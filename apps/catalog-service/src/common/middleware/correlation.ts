import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  
  // Inject into request headers so downstream services can receive it
  req.headers['x-correlation-id'] = correlationId;
  
  // Inject into response headers for visibility
  res.setHeader('x-correlation-id', correlationId);
  
  next();
};
