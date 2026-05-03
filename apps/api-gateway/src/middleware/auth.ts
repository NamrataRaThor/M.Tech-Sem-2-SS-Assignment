import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../common/index';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { message: 'Unauthorized: No token provided' } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Inject identity into headers for downstream services
    req.headers['x-user-id'] = decoded.id.toString();
    req.headers['x-user-role'] = decoded.role;
    
    return next();
  } catch (error) {
    logger.warn({ error }, 'Invalid JWT token');
    return res.status(401).json({ success: false, error: { message: 'Unauthorized: Invalid token' } });
  }
};
