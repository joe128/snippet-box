// Builds THIRD_PARTY_NOTICES.txt from `pnpm licenses list --prod --json -r`.
// Usage: pnpm licenses list --prod --json -r | node scripts/third-party-notices.mjs > THIRD_PARTY_NOTICES.txt
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i;

const readNotices = dir => {
  try {
    return readdirSync(dir)
      .filter(f => LICENSE_FILE.test(f))
      .sort()
      .map(f => readFileSync(join(dir, f), 'utf8').trim());
  } catch {
    return [];
  }
};

const input = JSON.parse(readFileSync(0, 'utf8'));
const packages = Object.values(input)
  .flat()
  .sort((a, b) => a.name.localeCompare(b.name));

const out = [
  'THIRD-PARTY SOFTWARE NOTICES',
  '',
  'Snippet Box includes the following third-party packages.',
  'Each is distributed under the license shown below.',
  ''
];

for (const pkg of packages) {
  const texts = readNotices(pkg.paths[0]);

  out.push('='.repeat(78));
  out.push(`${pkg.name}@${pkg.versions.join(', ')}`);
  out.push(`License: ${pkg.license}`);
  if (pkg.homepage) out.push(`Homepage: ${pkg.homepage}`);
  out.push('');
  out.push(texts.length ? texts.join('\n\n') : `(no license file shipped - see the ${pkg.license} license)`);
  out.push('');
}

process.stdout.write(out.join('\n'));
