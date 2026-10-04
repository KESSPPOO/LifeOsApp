// src/data/helpers.js

// localDateKey lives in src/core/time/dates.js (with the reason never to use
// toISOString() for calendar dates); re-exported here for existing callers.
import { localDateKey } from '../core/time/dates.js';

export { localDateKey };

export function todayKey() {
  return localDateKey(new Date());
}

export function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Formats numbers with thousand separators
export function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

export function diffDays(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// Grades are stored as 18-30, with 31 representing "30L" (30 cum laude).
// For arithmetic, 30L counts as 30 — this converts the stored value to its
// numeric weight for averages.
//
// Hardened: always returns a finite number, never NaN. Any non-numeric,
// missing, or out-of-range input collapses to 0 rather than poisoning a
// reduce() sum further up the chain (a single NaN here used to silently
// turn every average in the app into "-").
export function gradeWeight(grade) {
  const n = Number(grade);
  if (!grade || Number.isNaN(n)) return 0;
  if (n === 31) return 30;
  if (n < 18 || n > 30) return 0;
  return n;
}

// Returns true if the stored grade value represents 30L
export function isLode(grade) {
  return Number(grade) === 31;
}

// Human-readable label for a stored grade value (18-30, or 31 for 30L)
export function gradeLabel(grade) {
  const n = Number(grade);
  if (!grade || Number.isNaN(n)) return null;
  return n === 31 ? '30L' : String(n);
}

export function calculateAverages(exams) {
  const passed = (exams || []).filter(e => e.achievedGrade && gradeWeight(e.achievedGrade) > 0);
  if (!passed.length) return { average: 0, weightedAverage: 0 };

  const sum = passed.reduce((a, e) => a + gradeWeight(e.achievedGrade), 0);
  const wp  = passed.reduce((a, e) => a + (gradeWeight(e.achievedGrade) * (Number(e.credits) || 0)), 0);
  const wc  = passed.reduce((a, e) => a + (Number(e.credits) || 0), 0);

  return { average: sum / passed.length, weightedAverage: wc ? wp / wc : 0 };
}

// Italian graduation grade is based on a base of 110.
export function predictedDegreeGrade(weightedAverage) {
  if (!weightedAverage || Number.isNaN(weightedAverage) || weightedAverage < 18) return 0;
  return Math.min(110, Math.round((weightedAverage / 30) * 110 + (weightedAverage > 28 ? 1 : 0)));
}

export function padTime(n) {
  return String(n).padStart(2, '0');
}

export function fmtTimer(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${padTime(h)}:${padTime(m)}:${padTime(s)}`;
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
