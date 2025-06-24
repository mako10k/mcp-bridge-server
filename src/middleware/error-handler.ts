import express from 'express';
import { logger } from '../utils/logger.js';

/**
 * Error handling middleware
 */
export const errorHandler = (
  error: Error, 
  req: express.Request, 
  res: express.Response, 
  next: express.NextFunction
) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
};

/**
 * Register error handling middleware
 */
export const registerErrorHandler = (app: express.Application): void => {
  app.use(errorHandler);
};
