import type { SearchQuery } from './types';

// Values are plain words or "quoted strings" (tags may contain spaces)
const VALUE = String.raw`(?:"[^"]+"|[\w.+#-]+)`;
const FILTER = new RegExp(`(tags|lang):(${VALUE}(?:,${VALUE})*)`, 'g');

/** Formats a single filter value so parseSearch reads it back unchanged */
export const searchValue = (value: string) =>
  /^[\w.+#-]+$/.test(value) ? value : `"${value.replace(/"/g, '')}"`;

/** "docker lang:bash tags:ops,ci" -> { query: 'docker', languages: ['bash'], tags: ['ops','ci'] } */
export const parseSearch = (raw: string): SearchQuery => {
  const result: SearchQuery = { query: '', tags: [], languages: [] };

  for (const [, key, values] of raw.matchAll(FILTER)) {
    const list = (values.match(new RegExp(VALUE, 'g')) || []).map(v => v.replace(/"/g, '').toLowerCase());
    (key === 'tags' ? result.tags : result.languages).push(...list);
  }

  result.query = raw.replace(FILTER, '').replace(/\s+/g, ' ').trim();
  return result;
};
