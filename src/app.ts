import { existsSync } from 'fs';
import { join } from 'path';
import express from 'express';
import helmet from 'helmet';
import { Logger } from './utils';
import {
  basicAuth,
  errorHandler,
  rejectEncodedBodies,
  sameOriginOnly
} from './middleware';
import { snippetRouter } from './routes/snippets';

const logger = new Logger('app');

export interface AppOptions {
  /** Enables HTTP Basic auth when set */
  authPassword?: string;
  authUser?: string;
  /** Directory with the built client; null disables static serving */
  publicDir?: string | null;
}

// Docker copies the client to public/, a local `pnpm build` leaves it in client/build/
export const findPublicDir = () =>
  [join(__dirname, '../public'), join(__dirname, '../client/build')].find(dir =>
    existsSync(join(dir, 'index.html'))
  ) ?? null;

export const createApp = ({ authPassword, authUser = 'admin', publicDir = findPublicDir() }: AppOptions = {}) => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'upgrade-insecure-requests': null
        }
      },
      // Served over plain HTTP on a LAN in many setups - let a reverse proxy set HSTS
      strictTransportSecurity: false
    })
  );

  // Liveness probe for Docker/CI - before auth, reveals nothing
  app.get('/healthz', (req, res) => {
    res.type('text/plain').send('ok');
  });

  if (authPassword) {
    app.use(basicAuth(authUser, authPassword));
  } else {
    logger.log('AUTH_PASSWORD is not set - anyone with network access can edit snippets', 'WARN');
  }

  // API
  app.use(
    '/api',
    rejectEncodedBodies,
    sameOriginOnly,
    // inflate:false makes body-parser refuse gzip/deflate/br outright (415)
    express.json({ limit: '1mb', inflate: false, strict: true }),
    snippetRouter
  );
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Client
  if (publicDir) {
    app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(join(publicDir, 'index.html'));
    });
  } else {
    // `pnpm dev`: the UI is served by Vite, this port only hosts the API
    logger.log('Client is not built - open the Vite dev server (http://localhost:5173) or run "pnpm build"', 'WARN');
    app.get('/{*splat}', (req, res) => {
      res
        .status(503)
        .type('text/plain')
        .send('Snippet Box UI is not built.\n\nDevelopment: open http://localhost:5173 (started by "pnpm dev").\nProduction: run "pnpm build", then "pnpm start".\n');
    });
  }

  app.use(errorHandler);

  return app;
};
