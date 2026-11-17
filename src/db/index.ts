import path from 'path';
import { mkdirSync } from 'fs';
import { QueryTypes, Sequelize } from 'sequelize';
import Umzug from 'umzug';
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

// Migrations run as .ts with tsx (dev) and as .js from build/ (prod)
const migrationExt = path.extname(__filename);

// Migrations config
const umzug = new Umzug({
  migrations: {
    path: path.join(__dirname, './migrations'),
    params: [sequelize.getQueryInterface()],
    pattern: new RegExp(`^\\d+[\\w-]+\\${migrationExt}$`)
  },
  storage: 'sequelize',
  storageOptions: {
    sequelize
  },
  logging: false
});

/**
 * umzug v2 records migrations by file name *including* the extension. A DB
 * created by the compiled server (00_initial.js) would otherwise look
 * un-migrated to the dev server (00_initial.ts) and fail with
 * "table already exists" - and vice versa.
 */
const normalizeExecutedMigrations = async () => {
  const qi = sequelize.getQueryInterface();
  if (!(await qi.tableExists('SequelizeMeta'))) return;

  const otherExt = migrationExt === '.ts' ? '.js' : '.ts';
  const replacements = { ext: migrationExt, pattern: `%${otherExt}` };

  await sequelize.transaction(async transaction => {
    // A migration can be recorded with both extensions (e.g. after an
    // interrupted dev run) - drop the twin first, name is the primary key
    await sequelize.query(
      `DELETE FROM SequelizeMeta
       WHERE name LIKE :pattern
       AND substr(name, 1, length(name) - 3) || :ext IN (SELECT name FROM SequelizeMeta)`,
      { replacements, type: QueryTypes.DELETE, transaction }
    );

    await sequelize.query(
      `UPDATE SequelizeMeta
       SET name = substr(name, 1, length(name) - 3) || :ext
       WHERE name LIKE :pattern`,
      { replacements, type: QueryTypes.UPDATE, transaction }
    );
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
        pendingMigrations.forEach(({ file }: { file: string }) =>
          logger.log(`Executing ${file} migration`, 'DEV')
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
