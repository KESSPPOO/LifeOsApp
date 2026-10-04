// src/features/calendar/logic.js
//
// Kalender is a VIEW: what does this day, or this week, look like? Every
// item comes from the shared per-date schedule (getScheduleForDate in
// src/features/schedule/day.js: stored tasks plus derived routine
// occurrences, the same items and overlaps Tidshjul shows). Nothing here is
// stored, copied or generated ahead: a day is derived when it is shown, a
// week is its seven dates. See ADR-009.
//
// Pure: dates and "now" are passed in. Geometry is in points (the screen
// draws it as given) and keeps every position true to the clock: only a
// block's height is raised to a readable, touchable minimum, and blocks
// that would then cover each other sit side by side instead.
import { getScheduleForDate, describeScheduledItem, dayRelation } from '../schedule/day.js';
import { addDays, startOfWeek, isoWeekNumber } from '../../core/time/dates.js';
import { MINUTES_PER_DAY, minutesToTime } from '../../core/time/timeOfDay.js';
import { t, formatDateLong, formatDateRange } from '../../core/i18n/index.js';

// ── Mode and selected date ───────────────────────────────────────────────
//
// One selected date for both modes, kept while the screen is open and
// never stored. date null = follow today (also across midnight). Uge is
// the default: Tidshjul already answers "my day", the week is what no other
// screen shows, and Uge still shows the selected day (today) below it.

export const DEFAULT_MODE = 'week';
export const INITIAL_CALENDAR = { mode: DEFAULT_MODE, date: null };

/** The date the calendar shows. */
export const selectedDate = (state, today) => state.date ?? today;

const follow = (date, today) => (date === today ? null : date);

/**
 * The calendar's navigation (a useReducer reducer):
 *   { type: 'mode', mode }            Dag / Uge; the date is kept
 *   { type: 'step', direction, today } ±1 day in Dag, ±1 week in Uge (same weekday)
 *   { type: 'select', date, today }   a day (tapped in Uge)
 *   { type: 'today' }                 back to today
 */
export function calendarReducer(state, action) {
  switch (action.type) {
    case 'mode':
      return action.mode === state.mode ? state : { ...state, mode: action.mode };
    case 'step': {
      const days = action.direction * (state.mode === 'week' ? 7 : 1);
      return { ...state, date: follow(addDays(selectedDate(state, action.today), days), action.today) };
    }
    case 'select':
      return { ...state, date: follow(action.date, action.today) };
    case 'today':
      return state.date === null ? state : { ...state, date: null };
    default:
      return state;
  }
}

/** The seven dates, Monday first, of the week containing `date`. */
export function weekDates(date) {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** The heading: Dag 'Mandag den 5. oktober' / 'Uge 41'; subline: the week, or the week's dates. */
export function calendarTitle(mode, date, today) {
  const week = t('today.week', { week: isoWeekNumber(date) });
  if (mode === 'day') return { title: formatDateLong(date, today), subline: week };
  const days = weekDates(date);
  return { title: week, subline: formatDateRange(days[0], days[6], today) };
}

// ── The time window ──────────────────────────────────────────────────────

/** Points per hour in Dag. */
export const HOUR_HEIGHT = 72;
/** A block is never lower than this (a touch target with room for its title). */
export const MIN_BLOCK_HEIGHT = 44;
/** Always in view: the waking day. */
export const WAKING_HOURS = { start: 8 * 60, end: 20 * 60 };
const PADDING_MINUTES = 60;

const clip = (minute) => Math.min(MINUTES_PER_DAY, Math.max(0, minute));

/**
 * The part of the day to draw, in whole hours: the waking day, widened to
 * every item (the part on this date) and `nowMinute` (or null) with an
 * hour's margin, within 00:00–24:00. Never the empty 24 hours by default.
 */
export function timeWindow(items, nowMinute = null) {
  let start = WAKING_HOURS.start;
  let end = WAKING_HOURS.end;
  const include = (from, to) => {
    start = Math.min(start, from - PADDING_MINUTES);
    end = Math.max(end, to + PADDING_MINUTES);
  };
  for (const item of items) include(clip(item.start), clip(item.end ?? item.start));
  if (nowMinute !== null) include(nowMinute, nowMinute);
  return { start: Math.max(0, Math.floor(start / 60) * 60), end: Math.min(MINUTES_PER_DAY, Math.ceil(end / 60) * 60) };
}

// ── Dag ──────────────────────────────────────────────────────────────────

const PX_PER_MINUTE = HOUR_HEIGHT / 60;
const toY = (minute, window) => Math.round((minute - window.start) * PX_PER_MINUTE);

/**
 * Geometry for each item (already in time order): top at its true start
 * (00:00 for one from the day before), height by its duration (a point
 * keeps no length), at least MIN_BLOCK_HEIGHT. Blocks that would cover one
 * another share the width: `column` of `columns`.
 */
function layoutBlocks(items, window) {
  const blocks = items.map(item => {
    const from = clip(item.start);
    const height = item.end === null ? 0 : toY(clip(item.end), window) - toY(from, window);
    return { ...item, top: toY(from, window), height: Math.max(MIN_BLOCK_HEIGHT, height), column: 0, columns: 1 };
  });
  let group = [];
  let bottoms = [];
  const closeGroup = () => { for (const block of group) block.columns = bottoms.length; };
  for (const block of blocks) {
    if (group.length > 0 && block.top >= Math.max(...bottoms)) {
      closeGroup();
      group = [];
      bottoms = [];
    }
    let column = bottoms.findIndex(bottom => bottom <= block.top);
    if (column === -1) column = bottoms.push(0) - 1;
    bottoms[column] = block.top + block.height;
    block.column = column;
    group.push(block);
  }
  closeGroup();
  return blocks;
}

/** Routines on a past date are projected from the routine as it is now (ADR-008). */
const projectsRoutines = (date, today, items) => date < today && items.some(item => item.kind === 'routine');

/**
 * Everything Dag shows for `date`:
 *   items      timed items (getScheduleForDate) with top / height /
 *              column / columns
 *   conflicts  overlap groups (the same as Tidshjul's)
 *   untimed    tasks and routines of the date without a time (done ones
 *              included, shown subdued)
 *   window     { start, end } minutes drawn, or null without timed items
 *   hours      [{ minute, label, top }] hour lines in the window
 *   nowMinute / nowTop  only on today (null otherwise)
 *   height     points the grid needs
 *   state      'scheduled' | 'onlyUntimed' | 'empty'
 *   projected  true when it shows routines on a past date (see ADR-009)
 */
export function buildCalendarDay({ journal, routines = [], routineLog = [], date, today, nowMinutes }) {
  const { items, conflicts, untimed } = getScheduleForDate({ journal, routines, routineLog, date, today, nowMinutes });
  const relation = dayRelation(date, today);
  const nowMinute = relation === 'today' ? nowMinutes : null;
  const window = items.length > 0 ? timeWindow(items, nowMinute) : null;
  const blocks = window ? layoutBlocks(items, window) : [];
  const hours = [];
  if (window) {
    for (let minute = window.start; minute <= window.end; minute += 60) {
      hours.push({ minute, label: minute === MINUTES_PER_DAY ? '24:00' : minutesToTime(minute), top: toY(minute, window) });
    }
  }
  return {
    date,
    relation,
    items: blocks,
    conflicts,
    untimed,
    window,
    hours,
    nowMinute,
    nowTop: window && nowMinute !== null ? toY(nowMinute, window) : null,
    height: window ? Math.max(toY(window.end, window), ...blocks.map(b => b.top + b.height)) : 0,
    state: items.length > 0 ? 'scheduled' : untimed.length > 0 ? 'onlyUntimed' : 'empty',
    projected: projectsRoutines(date, today, [...items, ...untimed]),
  };
}

// ── Uge ──────────────────────────────────────────────────────────────────

/**
 * The seven days of `date`'s week, Monday first. Per day:
 *   items     its timed items (as in Dag), each with a `bar`: { left,
 *             width } as fractions of the week's shared window (width 0 =
 *             a point), and its lane (overlapping items do not hide each
 *             other)
 *   count     what is planned that day: items starting on it plus untimed
 *             (a task running past midnight counts on its own day only)
 *   doneCount, conflictCount (overlap groups, as in Tidshjul)
 *   lanes     lines its track needs (one per overlapping item)
 *   isToday
 * window: one for the whole week, so the days line up.
 * The same for every date of a week (the selected day is the screen's), and
 * no statuses are shown, so the week never depends on the clock: it is
 * rebuilt only when the week or the stored lists change.
 */
export function buildCalendarWeek({ journal, routines = [], routineLog = [], date, today }) {
  const days = weekDates(date).map(day => {
    const { items, conflicts, untimed } = getScheduleForDate({ journal, routines, routineLog, date: day, today, nowMinutes: 0 });
    const own = [...items.filter(item => item.date === day), ...untimed];
    return {
      date: day,
      isToday: day === today,
      items,
      count: own.length,
      doneCount: own.filter(item => item.done).length,
      conflictCount: conflicts.length,
      lanes: Math.max(1, ...items.map(item => item.lane + 1)),
      projected: projectsRoutines(day, today, [...items, ...untimed]),
    };
  });
  const window = timeWindow(days.flatMap(day => day.items));
  const span = window.end - window.start;
  const fraction = (minute) => (clip(minute) - window.start) / span;
  for (const day of days) {
    day.items = day.items.map(item => {
      const left = fraction(item.start);
      return { ...item, bar: { left, width: item.end === null ? 0 : fraction(item.end) - left } };
    });
  }
  const axis = [];
  // Hour labels every four hours ('08', '12', …) above the tracks.
  for (let minute = Math.ceil(window.start / 240) * 240; minute <= window.end; minute += 240) {
    axis.push({ label: minute === MINUTES_PER_DAY ? '24' : minutesToTime(minute).slice(0, 2), left: fraction(minute) });
  }
  return {
    days,
    window,
    axis,
    empty: days.every(day => day.count === 0 && day.items.length === 0),
    projected: days.some(day => day.projected),
  };
}

// ── In words (screen readers) ────────────────────────────────────────────

/** A timed item: 'fra 10:00 til 11:00, Tandlæge, 1 time, Opgave, klaret, overlapper med Træning'. */
export function describeCalendarItem(item, items) {
  return describeScheduledItem(item.kind === 'routine' ? item : { ...item, kindLabel: t('calendar.task') }, items);
}

/** An untimed item's state: progress or klaret, vigtig. */
const untimedState = (item) => [
  item.done ? t('timewheel.done') : item.progressText ?? null,
  item.important ? t('task.meta.important') : null,
].filter(Boolean);

/** What an untimed row shows besides its title: the kind (a routine), then its state. */
export function untimedDetails(item) {
  return [item.kindLabel ?? null, ...untimedState(item)].filter(Boolean);
}

/** An untimed item: 'Ring til mor, Opgave, uden tidspunkt, klaret'. */
export function describeUntimedItem(item) {
  return [item.title, item.kindLabel ?? t('calendar.task'), t('calendar.a11y.untimed'), ...untimedState(item)].join(', ');
}

/** What a week row says it holds: '3 ting', 'Fra dagen før' (only an item from the night before) or 'Åben'. */
export function weekDayCount(day) {
  if (day.count > 0) return t('calendar.count', { count: day.count });
  return t(day.items.length > 0 ? 'calendar.continued' : 'calendar.dayOpen');
}

/** A day in Uge: 'Mandag den 5. oktober, i dag, 3 planlagte ting, 1 klaret, 1 konflikt' (selection is a state). */
export function describeWeekDay(day, today) {
  return [
    formatDateLong(day.date, today),
    day.isToday ? t('nav.today').toLowerCase() : null,
    day.count > 0 ? t('calendar.a11y.count', { count: day.count }) : weekDayCount(day).toLowerCase(),
    day.doneCount > 0 ? t('calendar.done', { count: day.doneCount }) : null,
    day.conflictCount > 0 ? t('calendar.conflicts', { count: day.conflictCount }) : null,
  ].filter(Boolean).join(', ');
}
