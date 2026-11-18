import path from 'path';
import { mkdirSync } from 'fs';
import { QueryTypes, Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { Logger } from '../utils/Logger';

const logger = new Logger('db');

// src/db and build/db both resolve to <project>/data - independent of the cwd
const storage =
  process.env.DB_PATH ||
  path.join(__dirname, '../../data/db.sqlite3');

// DB config
export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
  logging: false
});

// Migrations are listed explicitly instead of globbed from disk: the same
// list works under tsx (.ts) and from build/ (.js), and the recorded names
// carry no file extension. Loaded lazily - 02_tags imports the models,
// which import this module.
const umzug = new Umzug({
  migrations: async () => [
    { name: '00_initial', ...(await import('./migrations/00_initial')) },
    { name: '01_pinned_snippets', ...(await import('./migrations/01_pinned_snippets')) },
    { name: '02_tags', ...(await import('./migrations/02_tags')) }
  ],
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: undefined
});

/**
 * umzug v2 recorded migrations by file name *including* the extension
 * (00_initial.js from the compiled server, 00_initial.ts from tsx). Rename
 * those entries to the extension-less names used since umzug v3, so existing
 * databases are not migrated a second time ("table already exists").
 */
const normalizeExecutedMigrations = async () => {
  const qi = sequelize.getQueryInterface();
  if (!(await qi.tableExists('SequelizeMeta'))) return;

  const withExt = `(name LIKE '%.js' OR name LIKE '%.ts')`;
  const stem = 'substr(name, 1, length(name) - 3)';

  const [{ legacy }] = await sequelize.query<{ legacy: number }>(
    `SELECT COUNT(*) AS legacy FROM SequelizeMeta WHERE ${withExt}`,
    { type: QueryTypes.SELECT }
  );
  if (legacy === 0) return;

  logger.log(
    'Converting migration records to the umzug v3 format - older versions (v1, fork < this release) ' +
      'can no longer open this database afterwards. Keep a backup of db.sqlite3 if you may need to downgrade.',
    'WARN'
  );

  await sequelize.transaction(async transaction => {
    // name is the primary key - drop twins before renaming:
    // .ts next to .js (interrupted dev run), and entries already renamed
    await sequelize.query(
      `DELETE FROM SequelizeMeta
       WHERE name LIKE '%.ts' AND ${stem} || '.js' IN (SELECT name FROM SequelizeMeta)`,
      { type: QueryTypes.DELETE, transaction }
    );
    await sequelize.query(
      `DELETE FROM SequelizeMeta
       WHERE ${withExt} AND ${stem} IN (SELECT name FROM SequelizeMeta)`,
      { type: QueryTypes.DELETE, transaction }
    );

    await sequelize.query(`UPDATE SequelizeMeta SET name = ${stem} WHERE ${withExt}`, {
      type: QueryTypes.UPDATE,
      transaction
    });
  });
};

const hint = (err: unknown): string => {
  const code = (err as { parent?: { code?: string } }).parent?.code;
  const message = (err as Error).message || '';

  // sqlite3 ships a native binding that is only built by its install script
  if (/sqlite3|bindings file|node_sqlite3/i.test(message)) {
    return ' - the sqlite3 native module is missing: make sure "pnpm install" finished without errors (sqlite3 must be allowed under allowBuilds)';
  }

  if (code === 'SQLITE_CANTOPEN' || code === 'SQLITE_READONLY') {
    return (
      ` - ${path.dirname(storage)} is not writable for uid ${process.getuid?.() ?? '?'}.` +
      ' With a bind mount, chown the host folder to 1000:1000 (rootful Docker) or run' +
      ' "docker run --rm -v ./data:/data alpine chown -R 1000:1000 /data" (rootless Docker),' +
      ' or use a named volume'
    );
  }

  return '';
};

export const connectDB = async () => {
  const isDev = process.env.NODE_ENV == 'development';

  try {
    mkdirSync(path.dirname(storage), { recursive: true });

    // Create & connect db
    await sequelize.authenticate();
    logger.log(`Database connected (${storage})`);

    await normalizeExecutedMigrations();

    // Check migrations
    const pendingMigrations = await umzug.pending();

    if (pendingMigrations.length > 0) {
      logger.log(`Found pending migrations. Executing...`);

      if (isDev) {
        pendingMigrations.forEach(({ name }) =>
          logger.log(`Executing ${name} migration`, 'DEV')
        );
      }
    }

    await umzug.up();
  } catch (err) {
    // Always show the cause - a bare "connection error" is impossible to debug
    // Sequelize's message alone can be as vague as "Validation error"
    const { name, message, errors } = err as Error & { errors?: { message: string }[] };
    const details = errors?.map(e => e.message).join(', ');

    logger.log(
      `Database connection error: ${name}: ${message}${details ? ` (${details})` : ''}${hint(err)}`,
      'ERROR'
    );

    if (isDev) {
      console.log(err);
    }

    process.exit(1);
  }
};
