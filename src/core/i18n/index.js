// src/core/i18n/index.js
//
// String lookup for Danish UI text (docs/LIFEOS_PLAN.md § 4: a plain table
// and t(), no library until more languages or richer plural rules are
// needed). Formatting helpers live in ./format.js and are re-exported here.
import { da } from './da.js';
import { formatNumber } from './format.js';

export * from './format.js';

/**
 * t('task.progress', { done: 2, total: 5 }) -> '2 af 5 klaret i dag'.
 * Numbers in params are formatted the Danish way. A { one, other } entry is
 * picked by params.count. An unknown key returns the key itself, so a typo
 * shows up on screen instead of crashing (tests check every used key).
 */
export function t(key, params) {
  const entry = da[key];
  if (entry === undefined) return key;
  const text = typeof entry === 'string' ? entry : (params?.count === 1 ? entry.one : entry.other);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    if (!(name in params)) return match;
    const v = params[name];
    return typeof v === 'number' ? formatNumber(v) : String(v);
  });
}
