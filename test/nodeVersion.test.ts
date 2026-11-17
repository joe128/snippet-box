import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isPatchedNode } from '../src/security/nodeVersion';

describe('Broccoli2Shell runtime check', () => {
  const cases: [string, boolean][] = [
    ['14.21.3', false],
    ['20.19.0', false],
    ['22.23.3', false],
    ['22.23.4', true],
    ['22.24.0', true],
    ['24.22.0', false],
    ['24.22.1', true],
    ['24.23.0', true],
    ['25.9.0', false],
    ['26.12.0', false],
    ['26.12.1', true],
    ['27.0.0', true]
  ];

  for (const [version, patched] of cases) {
    test(`Node ${version} is ${patched ? 'patched' : 'vulnerable'}`, () => {
      assert.equal(isPatchedNode(version), patched);
    });
  }
});
