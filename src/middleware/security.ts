import { timingSafeEqual, createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../utils';

/**
 * Snippet Box clients never send compressed request bodies. Rejecting every
 * Content-Encoding other than identity keeps attacker-controlled Brotli data
 * (Broccoli2Shell, CVE-2026-111497) away from the zlib decoder entirely.
 */
export const rejectEncodedBodies = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const encoding = (req.headers['content-encoding'] || 'identity')
    .toString()
    .trim()
    .toLowerCase();

  if (encoding !== 'identity') {
    return next(new ErrorResponse(415, 'Compressed request bodies are not supported'));
  }

  next();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Blocks cross-site state-changing requests (CSRF) using Fetch Metadata */
export const sameOriginOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (SAFE_METHODS.has(req.method)) return next();

  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') {
    return next(new ErrorResponse(403, 'Cross-site requests are not allowed'));
  }

  // req.is() returns null for bodyless requests (e.g. DELETE)
  if (req.is('application/json') === false) {
    return next(new ErrorResponse(415, 'Expected application/json'));
  }

  next();
};

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Optional HTTP Basic auth, enabled by setting AUTH_PASSWORD */
export const basicAuth = (user: string, password: string) => {
  const expected = digest(`${user}:${password}`);

  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');

    if (scheme === 'Basic' && encoded) {
      const given = digest(Buffer.from(encoded, 'base64').toString());
      if (timingSafeEqual(given, expected)) return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="Snippet Box", charset="UTF-8"');
    res.status(401).json({ error: 'Authentication required' });
  };
};
