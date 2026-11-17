import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch, searchValue } from './search';

describe('parseSearch', () => {
  test('plain text', () => {
    assert.deepEqual(parseSearch('  docker   prune '), { query: 'docker prune', tags: [], languages: [] });
  });

  test('language and tag filters', () => {
    assert.deepEqual(parseSearch('prune lang:bash tags:docker,ops'), {
      query: 'prune',
      tags: ['docker', 'ops'],
      languages: ['bash']
    });
  });

  test('filters are case-insensitive values', () => {
    assert.deepEqual(parseSearch('lang:TypeScript').languages, ['typescript']);
  });

  test('special characters in values', () => {
    assert.deepEqual(parseSearch('lang:c++ tags:c#,node.js').tags, ['c#', 'node.js']);
    assert.deepEqual(parseSearch('lang:c++').languages, ['c++']);
  });

  test('quoted values with spaces', () => {
    assert.deepEqual(parseSearch('tags:"disk cleanup",ops backup'), {
      query: 'backup',
      tags: ['disk cleanup', 'ops'],
      languages: []
    });
  });

  test('empty input', () => {
    assert.deepEqual(parseSearch(''), { query: '', tags: [], languages: [] });
  });
});

describe('searchValue', () => {
  test('leaves simple values alone', () => {
    assert.equal(searchValue('docker'), 'docker');
    assert.equal(searchValue('c++'), 'c++');
  });

  test('quotes values with spaces and strips quotes', () => {
    assert.equal(searchValue('disk cleanup'), '"disk cleanup"');
    assert.equal(searchValue('say "hi"'), '"say hi"');
  });

  test('round-trips through parseSearch', () => {
    for (const tag of ['ops', 'disk cleanup', 'c#', 'node.js']) {
      assert.deepEqual(parseSearch(`tags:${searchValue(tag)}`).tags, [tag]);
    }
  });
});
