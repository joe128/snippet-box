import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ErrorResponse } from '../utils';

/** Replaces req.body with the parsed value - unknown keys are stripped */
export const validateBody =
  (schema: z.ZodType) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const msg = result.error.issues
        .map(i => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      return next(new ErrorResponse(400, msg));
    }

    req.body = result.data;
    next();
  };

export const validateId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!/^\d{1,10}$/.test(String(req.params.id))) {
    return next(new ErrorResponse(400, 'Invalid snippet id'));
  }

  next();
};
