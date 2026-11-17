import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { json, snippet, startServer, TestServer } from './helpers';

let server: TestServer;
const api = (path: string, init?: RequestInit) => fetch(`${server.url}/api${path}`, init);

before(async () => {
  server = await startServer();
});

after(() => server.close());

describe('snippets CRUD', () => {
  test('creates a snippet and adds the language as tag', async () => {
    const res = await api('/snippets', json(snippet()));
    assert.equal(res.status, 201);

    const { data } = await res.json();
    assert.equal(data.title, 'List files');
    assert.equal(data.isPinned, false);
    assert.deepEqual(data.tags.sort(), ['bash', 'cli', 'files']);
  });

  test('lists and fetches snippets with their tags', async () => {
    const { data: list } = await (await api('/snippets')).json();
    assert.equal(list.length, 1);

    const { data } = await (await api(`/snippets/${list[0].id}`)).json();
    assert.equal(data.code, 'ls -la');
    assert.deepEqual(data.tags.sort(), ['bash', 'cli', 'files']);
  });

  test('updates a snippet and replaces its tags', async () => {
    const res = await api('/snippets/1', {
      ...json(snippet({ title: 'Renamed', tags: ['shell'] })),
      method: 'PUT'
    });
    assert.equal(res.status, 200);

    const { data } = await (await api('/snippets/1')).json();
    assert.equal(data.title, 'Renamed');
    assert.deepEqual(data.tags.sort(), ['bash', 'shell']);
  });

  test('pins and unpins a snippet', async () => {
    const pin = await api('/snippets/1/pin', { ...json({ isPinned: true }), method: 'PATCH' });
    assert.equal((await pin.json()).data.isPinned, true);

    const unpin = await api('/snippets/1/pin', { ...json({ isPinned: false }), method: 'PATCH' });
    assert.equal((await unpin.json()).data.isPinned, false);
  });

  test('counts tags', async () => {
    const { data } = await (await api('/snippets/statistics/count')).json();
    assert.deepEqual(data, [
      { count: 1, name: 'bash' },
      { count: 1, name: 'shell' }
    ]);
  });

  test('returns 404 for unknown snippets', async () => {
    const res = await api('/snippets/999');
    assert.equal(res.status, 404);
    assert.match((await res.json()).error, /999 was not found/);
  });

  test('deletes a snippet', async () => {
    const res = await api('/snippets/1', { method: 'DELETE' });
    assert.equal(res.status, 200);
    assert.equal((await api('/snippets/1')).status, 404);
  });
});

describe('search', () => {
  before(async () => {
    await api('/snippets', json(snippet({ title: 'Prune docker', code: 'docker system prune', tags: ['docker', 'ops'] })));
    await api('/snippets', json(snippet({ title: 'Read JSON', language: 'python', code: 'json.loads(s)', tags: ['files'] })));
    await api('/snippets', json(snippet({ title: 'Clean disk', description: 'free space', tags: ['disk cleanup'] })));
  });

  const search = async (body: object) => {
    const res = await api('/snippets/search', json({ query: '', tags: [], languages: [], ...body }));
    assert.equal(res.status, 200);
    return ((await res.json()).data as { title: string }[]).map(s => s.title).sort();
  };

  test('matches title, description and code', async () => {
    assert.deepEqual(await search({ query: 'docker' }), ['Prune docker']);
    assert.deepEqual(await search({ query: 'free space' }), ['Clean disk']);
    assert.deepEqual(await search({ query: 'json.loads' }), ['Read JSON']);
  });

  test('filters by language and tags', async () => {
    assert.deepEqual(await search({ languages: ['python'] }), ['Read JSON']);
    assert.deepEqual(await search({ tags: ['ops'] }), ['Prune docker']);
    assert.deepEqual(await search({ tags: ['disk cleanup'] }), ['Clean disk']);
  });

  test('returns nothing for an empty query', async () => {
    assert.deepEqual(await search({}), []);
  });
});
