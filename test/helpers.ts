import { mkdtempSync, rmSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AppOptions } from '../src/app';

export interface TestServer {
  url: string;
  /** Starts another app instance on the same database */
  spawn: (options: AppOptions) => Promise<{ url: string; close: () => Promise<void> }>;
  close: () => Promise<void>;
}

const listen = async (options: AppOptions) => {
  const { createApp } = await import('../src/app');
  const server: Server = createApp({ publicDir: null, ...options }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
};

/**
 * Boots the real app on a random port with a throw-away SQLite file.
 * The DB module reads DB_PATH on import, so it is imported lazily here.
 */
export const startServer = async (options: AppOptions = {}): Promise<TestServer> => {
  const dir = mkdtempSync(join(tmpdir(), 'snippet-box-test-'));
  process.env.DB_PATH = join(dir, 'db.sqlite3');

  const { connectDB, sequelize } = await import('../src/db');
  const { associateModels } = await import('../src/db/associateModels');
  await connectDB();
  await associateModels();

  const main = await listen(options);

  return {
    url: main.url,
    spawn: listen,
    close: async () => {
      await main.close();
      await sequelize.close();
      rmSync(dir, { recursive: true, force: true });
    }
  };
};

export const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

export const snippet = (overrides: Record<string, unknown> = {}) => ({
  title: 'List files',
  description: 'Show hidden files too',
  language: 'bash',
  code: 'ls -la',
  docs: '`-a` includes dotfiles',
  isPinned: false,
  tags: ['cli', 'files'],
  ...overrides
});
