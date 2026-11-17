import { Logger } from '../utils/Logger';

const logger = new Logger('security');

/**
 * Broccoli2Shell / Node2Shell (CVE-2026-111497): out-of-bounds write in the
 * Brotli decoder bundled with Node.js. Only these releases contain the fix.
 * Odd (non-LTS) lines that are end-of-life never received a patch.
 */
const PATCHED: Record<number, [number, number, number]> = {
  22: [22, 23, 4],
  24: [24, 22, 1],
  26: [26, 12, 1]
};
const FIRST_SAFE_MAJOR = 27;

export const isPatchedNode = (version = process.versions.node): boolean => {
  const [major, minor, patch] = version.split('.').map(Number);

  if (major >= FIRST_SAFE_MAJOR) return true;

  const fixed = PATCHED[major];
  if (!fixed) return false;

  const [, fMinor, fPatch] = fixed;
  return minor > fMinor || (minor === fMinor && patch >= fPatch);
};

export const assertPatchedNode = (): void => {
  if (isPatchedNode()) return;

  const msg =
    `Node.js ${process.versions.node} is vulnerable to Broccoli2Shell (CVE-2026-111497). ` +
    'Upgrade to 22.23.4+, 24.22.1+ or 26.12.1+.';

  if (process.env.ALLOW_VULNERABLE_NODE === '1') {
    logger.log(`${msg} Continuing because ALLOW_VULNERABLE_NODE=1`, 'WARN');
    return;
  }

  logger.log(msg, 'ERROR');
  process.exit(1);
};
