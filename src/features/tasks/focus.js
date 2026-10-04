// src/features/tasks/focus.js
//
// NU / NÆSTE: the one rule for "what is happening now, and what is next",
// shared by I dag and Timewheel so they can never disagree. Pure: the date
// and time ("now") are passed in; nothing is read from the clock and
// nothing is written.
//
// Two kinds of day items take part: tasks, and today's routine occurrences
// (routineItems, built by src/features/routines/model.js). Both have date /
// startTime / durationMinutes, so the same schedule rules sort them; a
// routine has no priority, so it ranks like a medium task. There is no
// preference by kind: equal keys keep tasks before routines (input order).
// Finished occurrences never take part, and neither does a routine whose
// time has passed: unlike a task it is not carried over (it comes back on
// its next day), so a missed or brand-new routine never takes NU. With no
// routines the result is exactly the task-only result.
//
// The unfinished tasks dated today or earlier ("due") are split by their
// schedule at `now` (./schedule.js):
//   active    a timed task with a duration whose interval contains now
//   upcoming  a timed task later today
//   flexible  everything else: untimed tasks, carried-over tasks, and timed
//             tasks whose time has passed (still open, never hidden)
// Flexible tasks are ranked by priority (high, medium, low; missing counts
// as medium), then date (oldest first), then time (a timed task whose time
// has come before the untimed ones of its day), then the user's own order.
//
//   1. The queue is: active items (earliest start first), then the ranked
//      flexible items, then today's unticked habits in list order.
//   2. NU = the first in the queue. Upcoming timed tasks are never NU: their
//      time has not come.
//   3. NÆSTE = the earliest upcoming timed item today; otherwise the next in
//      the queue; otherwise the earliest unfinished task on a later day.
import { groupJournal } from '../../data/tasks.js';
import { scheduleStatus, compareStart, compareDateStart } from './schedule.js';
import { taskItem, habitItem } from './items.js';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const priorityRank = (p) => PRIORITY_RANK[p] ?? PRIORITY_RANK.medium;

/** Unfinished due tasks in NU order (Array.prototype.sort is stable). */
export function rankDueTasks(tasks) {
  return [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || compareDateStart(a, b));
}

/**
 * journal: tasks + habits; today: 'YYYY-MM-DD'; nowMinutes: minutes since
 * today's midnight; keepVisibleIds: see groupJournal; routineItems: today's
 * routine occurrences as items (default none).
 *
 * Returns { now, next } (items, or null) plus the parts I dag builds its
 * overview from: groups (groupJournal), active, upcomingTimed and flexible
 * (unfinished due TASKS, each in NU order), dueDone (finished due tasks)
 * and habits (habit items).
 */
export function selectFocus({ journal, today, nowMinutes, keepVisibleIds, routineItems = [] }) {
  const groups = groupJournal(journal, today, keepVisibleIds);
  // Routine items are items already; tasks become items here.
  const item = (entry) => (entry.kind === 'routine' ? entry : taskItem(entry, today, nowMinutes));
  const due = [...groups.Overdue, ...groups.Today];
  const dueDone = due.filter(task => task.done);
  const active = [];
  const upcomingTimed = [];
  const flexibleOpen = [];
  for (const task of due) {
    if (task.done) continue;
    const status = scheduleStatus(task, today, nowMinutes);
    (status === 'active' ? active : status === 'upcoming' ? upcomingTimed : flexibleOpen).push(task);
  }
  active.sort(compareDateStart);
  upcomingTimed.sort(compareStart);
  const flexible = rankDueTasks(flexibleOpen);
  const habits = groups.Habits.map(h => habitItem(h, today));
  const laterDay = groups.Upcoming.filter(task => !task.done).sort(compareDateStart)[0];

  const openRoutines = routineItems.filter(routine => !routine.done);
  const ofStatus = (status) => openRoutines.filter(routine => routine.status === status);
  const allActive = [...active, ...ofStatus('active')].sort(compareDateStart);
  const allUpcoming = [...upcomingTimed, ...ofStatus('upcoming')].sort(compareStart);
  const allFlexible = rankDueTasks([...flexibleOpen, ...ofStatus('untimed')]);

  const queue = [...allActive.map(item), ...allFlexible.map(item), ...habits.filter(h => !h.done)];
  const now = queue[0] ?? null;
  const next = (allUpcoming[0] && item(allUpcoming[0])) ?? queue[1] ?? (laterDay ? item(laterDay) : null);

  return { now, next, groups, active, upcomingTimed, flexible, dueDone, habits };
}
