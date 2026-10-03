// src/features/links/logic.js
//
// Pure link operations (no React), moved from LinksScreen (and the Home
// Quick Links filter) so they can be unit-tested. Results are identical to
// the old inline code. A link is { id, name, url, icon, starred }, stored as
// a plain array under `lifeos_links` in the user's own (drag) order.

/** At most this many links can be starred (they appear on Home). */
export const MAX_STARRED_LINKS = 6;

/** Adds https:// when the URL does not start with "http". Expects trimmed text. */
export function normalizeLinkUrl(url) {
  return url.startsWith('http') ? url : 'https://' + url;
}

// Form text -> stored fields (trimmed name, normalised URL, default icon).
function linkFields({ name, url, icon }) {
  return { name: name.trim(), url: normalizeLinkUrl(url.trim()), icon: icon.trim() || '🔗' };
}

/** New links go to the end, unstarred. `id` is passed in (the screen uses Date.now()). */
export function addLink(list, fields, id) {
  return [...list, { id, ...linkFields(fields), starred: false }];
}

export function updateLink(list, id, fields) {
  return list.map(l => l.id === id ? { ...l, ...linkFields(fields) } : l);
}

export function deleteLink(list, id) {
  return list.filter(l => l.id !== id);
}

/** true when starring link `id` would exceed MAX_STARRED_LINKS. */
export function starLimitReached(list, id) {
  const link = list.find(l => l.id === id);
  return !!link && !link.starred && list.filter(l => l.starred).length >= MAX_STARRED_LINKS;
}

export function toggleLinkStar(list, id) {
  return list.map(l => l.id === id ? { ...l, starred: !l.starred } : l);
}

/** Home Quick Links: starred links in list order, capped at MAX_STARRED_LINKS. */
export function starredLinks(list) {
  return list.filter(l => l.starred).slice(0, MAX_STARRED_LINKS);
}
