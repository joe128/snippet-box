import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { json, snippet, startServer, TestServer } from './helpers';

let server: TestServer;
const api = (path: string, init?: RequestInit) => fetch(`${server.url}/api${path}`, init);

before(async () => {
  server = await startServer();
});

after(() => server.close());

describe('Broccoli2Shell (CVE-2026-111497): compressed request bodies', () => {
  const body = JSON.stringify(snippet());

  for (const [encoding, data] of [
    ['br', brotliCompressSync(body)],
    ['gzip', gzipSync(body)],
    ['deflate', Buffer.from(body)],
    ['br, gzip', brotliCompressSync(body)]
  ] as const) {
    test(`rejects Content-Encoding: ${encoding} with 415`, async () => {
      const res = await api('/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': encoding },
        body: data
      });
      assert.equal(res.status, 415);
    });
  }

  test('accepts identity encoding', async () => {
    const res = await api('/snippets', json(snippet(), { 'Content-Encoding': 'identity' }));
    assert.equal(res.status, 201);
  });
});

describe('stored XSS via raw endpoint', () => {
  test('serves code as sandboxed plain text', async () => {
    const created = await api('/snippets', json(snippet({ code: '<script>alert(1)</script>' })));
    const { data } = await created.json();

    const res = await api(`/snippets/raw/${data.id}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^text\/plain/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.equal(await res.text(), '<script>alert(1)</script>');
  });
});

describe('input validation', () => {
  test('ignores fields outside the schema (mass assignment)', async () => {
    const res = await api('/snippets', json({ ...snippet(), id: 9999, createdAt: '1999-01-01T00:00:00Z' }));
    const { data } = await res.json();
    assert.notEqual(data.id, 9999);
    assert.notEqual(new Date(data.createdAt).getFullYear(), 1999);
  });

  test('rejects wrong types', async () => {
    const res = await api('/snippets', json(snippet({ tags: 'not-an-array' })));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /tags/);
  });

  test('rejects missing required fields', async () => {
    const res = await api('/snippets', json({ title: 'only a title' }));
    assert.equal(res.status, 400);
  });

  test('rejects operator objects in search filters', async () => {
    const res = await api('/snippets/search', json({ query: '', tags: [], languages: [{ $ne: 1 }] }));
    assert.equal(res.status, 400);
  });

  test('rejects non-numeric ids', async () => {
    const res = await api('/snippets/1%20OR%201=1');
    assert.equal(res.status, 400);
  });

  test('rejects bodies over 1 MB', async () => {
    const res = await api('/snippets', json(snippet({ code: 'a'.repeat(1_100_000) })));
    assert.equal(res.status, 413);
  });

  test('rejects malformed JSON without leaking internals', async () => {
    const res = await api('/snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title":'
    });
    assert.equal(res.status, 400);
    assert.doesNotMatch(JSON.stringify(await res.json()), /[A-Z]:\\|\/home\/|node_modules/);
  });
});

describe('CSRF', () => {
  test('blocks cross-site state-changing requests', async () => {
    const res = await api('/snippets', json(snippet(), { 'Sec-Fetch-Site': 'cross-site' }));
    assert.equal(res.status, 403);
  });

  test('allows same-origin requests', async () => {
    const res = await api('/snippets', json(snippet(), { 'Sec-Fetch-Site': 'same-origin' }));
    assert.equal(res.status, 201);
  });

  test('requires a JSON content type for writes', async () => {
    const res = await api('/snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(snippet())
    });
    assert.equal(res.status, 415);
  });

  test('allows bodyless DELETE', async () => {
    const res = await api('/snippets/1', { method: 'DELETE' });
    assert.equal(res.status, 200);
  });
});

describe('security headers', () => {
  test('sets a strict CSP and hides the framework', async () => {
    const res = await api('/snippets');
    const csp = res.headers.get('content-security-policy') ?? '';
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('basic auth', () => {
  let secured: { url: string; close: () => Promise<void> };

  before(async () => {
    secured = await server.spawn({ authUser: 'admin', authPassword: 's3cret' });
  });

  after(() => secured.close());

  const basic = (credentials: string) => ({
    headers: { Authorization: `Basic ${Buffer.from(credentials).toString('base64')}` }
  });

  test('rejects missing credentials', async () => {
    const res = await fetch(`${secured.url}/api/snippets`);
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') ?? '', /^Basic/);
  });

  test('rejects wrong credentials', async () => {
    assert.equal((await fetch(`${secured.url}/api/snippets`, basic('admin:nope'))).status, 401);
    assert.equal((await fetch(`${secured.url}/api/snippets`, basic('root:s3cret'))).status, 401);
  });

  test('keeps the health check reachable for Docker', async () => {
    const res = await fetch(`${secured.url}/healthz`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'ok');
  });

  test('accepts the right credentials', async () => {
    assert.equal((await fetch(`${secured.url}/api/snippets`, basic('admin:s3cret'))).status, 200);
  });
});
