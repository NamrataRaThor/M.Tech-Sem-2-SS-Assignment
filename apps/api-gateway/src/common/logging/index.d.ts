import { Request, Response, NextFunction } from 'express';
export declare const logger: import("pino").Logger<never>;
export declare const httpLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const correlationIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;
