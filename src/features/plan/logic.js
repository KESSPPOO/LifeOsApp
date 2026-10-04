// src/features/plan/logic.js
//
// How the Plan screen groups and orders tasks and habits. Pure; the date is
// passed in. Built on groupJournal (src/data/tasks.js), so Plan and I dag
// agree on what is today, overdue and upcoming.
//
//   timedToday     today's tasks with a time, in time order (done ones
//                  keep their place, dimmed)
//   flexibleToday  today's tasks without a time, in the user's own order,
//                  finished ones last
//   overdue        unfinished tasks from earlier days: oldest first, then
//                  by time, then the user's order (tasks ticked during this
//                  visit stay, last, so the tap can be undone)
//   upcomingDays   later tasks grouped per day: [{ date, tasks }], each day
//                  unfinished first, timed before untimed in time order
//   noDate         tasks without a date (user's order, finished last)
//   habits         recurring habits (user's order)
//   progress       { done, total } for "X af Y klaret i dag" (as on I dag)
//
// Sorting is stable everywhere: equal keys keep the stored order.
import { groupJournal } from '../../data/tasks.js';
import {
  isTimed, compareStart, compareDateStart, withSchedule, getSchedule, isValidDuration, DURATION_CHOICES,
} from '../tasks/schedule.js';
import { parseTimeInput } from '../../core/time/timeOfDay.js';
import { dayProgress } from '../tasks/items.js';

const doneLast = (a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0);

export function groupPlan(journal, today, keepVisibleIds) {
  const groups = groupJournal(journal, today, keepVisibleIds);

  const upcoming = [...groups.Upcoming].sort((a, b) =>
    a.date.localeCompare(b.date) || doneLast(a, b) || compareStart(a, b));
  const timedToday = [];
  const flexibleToday = [];
  for (const task of groups.Today) (isTimed(task) ? timedToday : flexibleToday).push(task);
  const upcomingDays = [];
  for (const task of upcoming) {
    const day = upcomingDays.at(-1);
    if (day?.date === task.date) day.tasks.push(task);
    else upcomingDays.push({ date: task.date, tasks: [task] });
  }

  return {
    timedToday: timedToday.sort(compareStart),
    flexibleToday,
    overdue: [...groups.Overdue].sort((a, b) => doneLast(a, b) || compareDateStart(a, b)),
    upcomingDays,
    noDate: groups['No Date'],
    habits: groups.Habits,
    progress: dayProgress(groups, today),
  };
}

// ── List operations (what the Plan screen writes) ───────────────────────
// Each returns a new list; entries other than the one changed are the same
// objects. New ids follow the journal's existing convention (highest + 1).

const nextId = (list) => Math.max(0, ...list.map(x => Number(x.id) || 0)) + 1;

/**
 * The form's task fields: { text, subject, priority, date, startTime,
 * durationMinutes }. date '' or null = no date. withSchedule stores a time
 * only on a dated task and never stores empty schedule fields, so a task
 * saved without a time has no schedule keys.
 */
function taskFields(base, { text, subject, priority, date, startTime, durationMinutes }) {
  const next = { ...base, text, subject, priority, date: date || null };
  // Time fields the user did not change are left exactly as stored (even a
  // value this version does not understand), so editing only the title
  // never rewrites or drops schedule data.
  const stored = getSchedule(base);
  const unchanged = next.date === base.date
    && (startTime ?? null) === (stored ? base.startTime : null)
    && (durationMinutes ?? null) === (stored?.duration ?? null);
  return unchanged ? next : withSchedule(next, { startTime, durationMinutes });
}

export function addTask(list, fields) {
  return [...list, taskFields({ id: nextId(list), done: false, recurring: false }, fields)];
}

export function updateTask(list, id, fields) {
  return list.map(x => (x.id === id ? taskFields(x, fields) : x));
}

/** Same shape the old Tasks screen created for a habit. */
export function addHabit(list, { text, icon }) {
  return [...list, {
    id: nextId(list), text, subject: '', priority: 'medium', date: null,
    done: false, recurring: true, icon, history: {}, streak: 0,
  }];
}

export function updateHabit(list, id, { text, icon }) {
  return list.map(x => (x.id === id ? { ...x, text, icon } : x));
}

export function deleteEntry(list, id) {
  return list.filter(x => x.id !== id);
}

/**
 * After a drag within one section: that section's entries move to the end
 * of the list in their new order (as on the old Tasks screen). The current
 * stored entries are used, not the dragged copies, so a change saved while
 * dragging is not undone.
 */
export function reorderSection(list, reordered) {
  const byId = new Map(list.map(x => [x.id, x]));
  const moved = reordered.map(x => byId.get(x.id)).filter(Boolean);
  const ids = new Set(moved.map(x => x.id));
  return [...list.filter(x => !ids.has(x.id)), ...moved];
}

// ── The task form ─────────────────────────────────────────────────────────
// Form values: { text, subject, priority, date, timeText, durationChoice,
// customDuration, icon }. durationChoice is null (unknown), one of
// DURATION_CHOICES, or 'custom' (customDuration holds the typed minutes).

/** Form values for editing an existing task or habit (or a new one from `draft`). */
export function formFromEntry(entry) {
  const schedule = getSchedule(entry);
  const duration = schedule?.duration ?? null;
  const preset = DURATION_CHOICES.includes(duration);
  return {
    text: entry.text ?? '',
    subject: entry.subject ?? '',
    priority: entry.priority ?? 'medium',
    date: entry.date ?? '',
    timeText: schedule ? entry.startTime : '',
    durationChoice: duration === null ? null : preset ? duration : 'custom',
    customDuration: duration !== null && !preset ? String(duration) : '',
    icon: entry.icon ?? '🌟',
  };
}

/**
 * Validates the form. Returns { fields } (for addTask/updateTask, or
 * { text, icon } for a habit) or { error } with the i18n key to show.
 * A time needs a date; a duration is only read when there is a time.
 */
export function readTaskForm(kind, form) {
  const text = form.text.trim();
  if (!text) return { error: 'taskForm.missingTitle' };
  if (kind === 'habit') return { fields: { text, icon: form.icon.trim() || '🌟' } };

  let startTime = null;
  let durationMinutes = null;
  if (form.timeText.trim()) {
    if (!form.date) return { error: 'taskForm.timeNeedsDate' };
    startTime = parseTimeInput(form.timeText);
    if (!startTime) return { error: 'taskForm.timeInvalid' };
    if (form.durationChoice === 'custom') {
      durationMinutes = Number(form.customDuration.trim());
      if (!form.customDuration.trim() || !isValidDuration(durationMinutes)) return { error: 'taskForm.durationInvalid' };
    } else if (isValidDuration(form.durationChoice)) {
      durationMinutes = form.durationChoice;
    }
  }
  return {
    fields: {
      text, subject: form.subject.trim(), priority: form.priority,
      date: form.date || null, startTime, durationMinutes,
    },
  };
}
