import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryTypes } from 'sequelize';
import { startServer, TestServer } from './helpers';

// umzug v3 records extension-less names; v1 databases (umzug v2) carry .js/.ts names
const ALL = ['00_initial', '01_pinned_snippets', '02_tags'];

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
  assert.deepEqual(await names(), ALL);
});

test('upgrades a v1 database (umzug v2 names), including duplicate entries', async () => {
  const { connectDB, sequelize } = await import('../src/db');

  // State seen in the wild: DB created by the compiled v1 server (.js), then
  // an interrupted dev run re-recorded 00_initial as .ts
  await sequelize.query(`UPDATE SequelizeMeta SET name = name || '.js'`);
  await sequelize.query(`INSERT INTO SequelizeMeta (name) VALUES ('00_initial.ts')`);
  await sequelize.query(
    `INSERT INTO snippets (title, language, code, createdAt, updatedAt) VALUES ('keep me', 'bash', 'ls', datetime(), datetime())`
  );

  await connectDB();

  assert.deepEqual(await names(), ALL);

  const rows = await sequelize.query<{ title: string }>('SELECT title FROM snippets', { type: QueryTypes.SELECT });
  assert.deepEqual(rows.map(r => r.title), ['keep me']);
});

test('drops v2 entries whose extension-less twin already exists', async () => {
  const { connectDB, sequelize } = await import('../src/db');

  await sequelize.query(`INSERT INTO SequelizeMeta (name) VALUES ('01_pinned_snippets.ts'), ('02_tags.js')`);

  await connectDB();

  assert.deepEqual(await names(), ALL);
});
