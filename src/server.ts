import { assertPatchedNode } from './security/nodeVersion';
assertPatchedNode();

import { Logger } from './utils';
import { connectDB } from './db';
import { associateModels } from './db/associateModels';
import { createApp } from './app';

const logger = new Logger('server');
const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

(async () => {
  await connectDB();
  await associateModels();

  const app = createApp({
    authPassword: process.env.AUTH_PASSWORD,
    authUser: process.env.AUTH_USER
  });

  app.listen(PORT, HOST, () => {
    logger.log(`Server is working on ${HOST}:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
})();
