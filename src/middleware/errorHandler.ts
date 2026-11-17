import { STATUS_CODES } from 'http';
import { Request, Response, NextFunction } from 'express';
import { ErrorResponse, Logger } from '../utils';

const logger = new Logger('errorHandler');

export const errorHandler = (
  err: ErrorResponse & { status?: number; type?: string },
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // body-parser errors carry `status`, our own errors `statusCode`
  const status = err.statusCode || err.status || 500;

  logger.log(`${req.method} ${req.path} -> ${status}: ${err.message}`, status >= 500 ? 'ERROR' : 'WARN');

  // Only our own messages and body-parser's (they have a `type`) are meant for
  // clients. Anything else - fs errors with absolute paths, SQL, stack traces -
  // is replaced by the generic status text.
  const fromBodyParser = typeof (err as { type?: unknown }).type === 'string';
  const isPublic = status < 500 && (err instanceof ErrorResponse || fromBodyParser);

  res.status(status).json({
    error: isPublic ? err.message : STATUS_CODES[status] || 'Error'
  });
};
