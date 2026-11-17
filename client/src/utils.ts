import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { aliases } from './data/aliases_raw.json';

dayjs.extend(relativeTime);

export const fromNow = (date: string) => dayjs(date).fromNow();
export const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');

const aliasSet = new Set(aliases);
export const highlightLanguage = (language: string) => {
  const l = language.toLowerCase();
  return aliasSet.has(l) ? l : 'plaintext';
};

/** Stable hue per language so badges are recognisable at a glance */
export const languageHue = (language: string) => {
  let hash = 0;
  for (const ch of language.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
};

export { parseSearch, searchValue } from './search';

export const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text);
};
