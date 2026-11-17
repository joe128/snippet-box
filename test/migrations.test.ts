import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryTypes } from 'sequelize';
import { startServer, TestServer } from './helpers';

// Under tsx the migrations are the .ts files, the compiled server records .js
let server: TestServer;

before(async () => {
  server = await startServer();
});

after(() => server.close());

const names = async () => {
  const { sequelize } = await import('../src/db');
  const rows = await sequelize.query<{ name: string }>('SELECT name FROM SequelizeMeta ORDER BY name', {
    type: QueryTypes.SELECT
  });
  return rows.map(r => r.name);
};

test('records all migrations of a fresh database', async () => {
  assert.deepEqual(await names(), ['00_initial.ts', '01_pinned_snippets.ts', '02_tags.ts']);
});

test('accepts a database created by the compiled server, including duplicate entries', async () => {
  const { connectDB, sequelize } = await import('../src/db');

  // State seen in the wild: DB created by `pnpm start` (.js), then an
  // interrupted dev run re-recorded 00_initial as .ts
  await sequelize.query(`UPDATE SequelizeMeta SET name = replace(name, '.ts', '.js') WHERE name != '00_initial.ts'`);
  await sequelize.query(`INSERT INTO SequelizeMeta (name) VALUES ('00_initial.js')`);
  await sequelize.query(
    `INSERT INTO snippets (title, language, code, createdAt, updatedAt) VALUES ('keep me', 'bash', 'ls', datetime(), datetime())`
  );

  await connectDB();

  assert.deepEqual(await names(), ['00_initial.ts', '01_pinned_snippets.ts', '02_tags.ts']);

  const rows = await sequelize.query<{ title: string }>('SELECT title FROM snippets', { type: QueryTypes.SELECT });
  assert.deepEqual(rows.map(r => r.title), ['keep me']);
});
