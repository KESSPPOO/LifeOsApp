// src/features/training/sets.js
//
// What one set records, by the exercise's tracking type, and how it is
// typed and shown. Pure. See ADR-010.
//
//   weightReps        { weightKg, reps }      62,5 × 8
//   bodyweightReps    { reps }                8
//   duration          { seconds }             0:45
//   distanceDuration  { distanceKm, seconds } 5 km · 25:00
//
// Values are stored as numbers (kg and km with at most two decimals,
// whole reps and seconds). Input is Danish: '62,5' (a comma or a point),
// times as 'm:ss' (or 'h:mm:ss'; a bare number is seconds).
import { t, formatNumber, formatTimer, parseDecimalInput } from '../../core/i18n/index.js';
import { TRACKING, trackingOf } from './exercises.js';

export const SET_TYPES = ['warmup', 'work'];

const MAX_KG = 1000;
const MAX_REPS = 999;
const MAX_SECONDS = 24 * 3600;
const MAX_KM = 1000;

/** 'm:ss', 'h:mm:ss' or whole seconds -> seconds (1 … 24 h), else null. */
export function parseDurationInput(text) {
  const trimmed = String(text ?? '').trim();
  let seconds = null;
  if (/^\d+$/.test(trimmed)) seconds = Number(trimmed);
  else {
    const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(trimmed);
    if (match && Number(match[3]) < 60 && (match[1] === undefined || Number(match[2]) < 60)) {
      seconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    }
  }
  return seconds !== null && seconds > 0 && seconds <= MAX_SECONDS ? seconds : null;
}

function parseReps(text) {
  const trimmed = String(text ?? '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const reps = Number(trimmed);
  return reps >= 1 && reps <= MAX_REPS ? reps : null;
}

function parseKg(text) {
  const kg = parseDecimalInput(text, 2);
  return kg !== null && kg <= MAX_KG ? kg : null;
}

function parseKm(text) {
  const km = parseDecimalInput(text, 2);
  return km !== null && km > 0 && km <= MAX_KM ? km : null;
}

/**
 * The input fields of a tracking type, in order: { key, label (i18n),
 * keyboard, parse(text) -> number | null, toText(number) -> string }.
 */
const FIELD_SPECS = {
  weightKg:   { key: 'weightKg',   label: 'training.field.kg',      keyboard: 'decimal-pad', parse: parseKg, toText: (v) => formatNumber(v, 2) },
  reps:       { key: 'reps',       label: 'training.field.reps',    keyboard: 'number-pad',  parse: parseReps, toText: (v) => String(v) },
  seconds:    { key: 'seconds',    label: 'training.field.time',    keyboard: 'numbers-and-punctuation', parse: parseDurationInput, toText: (v) => formatTimer(v) },
  distanceKm: { key: 'distanceKm', label: 'training.field.km',      keyboard: 'decimal-pad', parse: parseKm, toText: (v) => formatNumber(v, 2) },
};

const FIELDS_BY_TYPE = {
  [TRACKING.WEIGHT_REPS]: ['weightKg', 'reps'],
  [TRACKING.BODYWEIGHT_REPS]: ['reps'],
  [TRACKING.DURATION]: ['seconds'],
  [TRACKING.DISTANCE_DURATION]: ['distanceKm', 'seconds'],
};

/** The input fields for a tracking type (unknown -> weight and reps). */
export const fieldsFor = (trackingType) => FIELDS_BY_TYPE[trackingOf({ trackingType })].map(key => FIELD_SPECS[key]);

/**
 * Reads typed texts ({ weightKg: '62,5', reps: '8' }) for a tracking type:
 * { values } with every field valid, or { error, field } (i18n key; the
 * first field that is missing or invalid). A set is never completed with
 * a missing or invalid value.
 */
export function parseSetInput(trackingType, texts) {
  const values = {};
  for (const field of fieldsFor(trackingType)) {
    const value = field.parse(texts?.[field.key]);
    if (value === null) return { error: `training.invalid.${field.key}`, field: field.key };
    values[field.key] = value;
  }
  return { values };
}

/** Stored values as input texts ({ weightKg: '62,5', reps: '8' }); missing values are left out. */
export function valuesToTexts(trackingType, values) {
  const texts = {};
  for (const field of fieldsFor(trackingType)) {
    const value = values?.[field.key];
    if (typeof value === 'number' && Number.isFinite(value)) texts[field.key] = field.toText(value);
  }
  return texts;
}

/** Compact, for the Sidst column and history: '62,5×8', '8', '0:45', '5 km · 25:00'; '' if nothing usable. */
export function formatSetValues(trackingType, values) {
  const texts = valuesToTexts(trackingType, values);
  if (fieldsFor(trackingType).some(field => texts[field.key] === undefined)) return '';
  switch (trackingOf({ trackingType })) {
    case TRACKING.WEIGHT_REPS: return `${texts.weightKg}×${texts.reps}`;
    case TRACKING.BODYWEIGHT_REPS: return texts.reps;
    case TRACKING.DURATION: return texts.seconds;
    default: return `${texts.distanceKm} km · ${texts.seconds}`;
  }
}

/** In words, for screen readers: '62,5 kilo, 8 gentagelser'; '' if nothing usable. */
export function describeSetValues(trackingType, values) {
  if (!formatSetValues(trackingType, values)) return '';
  const texts = valuesToTexts(trackingType, values);
  return fieldsFor(trackingType)
    .map(field => t(`training.a11y.${field.key}`, { value: texts[field.key], count: values[field.key] }))
    .join(', ');
}

/** 'Opvarmning' / 'Arbejdssæt'. */
export const setTypeLabel = (type) => t(type === 'warmup' ? 'training.setType.warmup' : 'training.setType.work');
