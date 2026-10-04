// src/features/today/logic.js
//
// What the I dag screen shows, derived from the stored lists. Pure: the
// date and time ("now") are passed in, nothing is read from the clock and
// nothing is written. Real data only.
//
// The unfinished tasks dated today or earlier ("due") are split by their
// schedule at `now` (src/features/tasks/schedule.js):
//   active    a timed task with a duration whose interval contains now
//   upcoming  a timed task later today
//   flexible  everything else: untimed tasks, carried-over tasks, and timed
//             tasks whose time has passed (still open, never hidden)
// Flexible tasks are ranked by priority (high, medium, low; missing counts
// as medium), then date (oldest first), then time (a timed task whose time
// has come before the untimed ones of its day), then the user's own order.
//
// NU / NÆSTE (deterministic):
//   1. The queue is: active tasks (earliest start first), then the ranked
//      flexible tasks, then today's unticked habits in list order.
//   2. NU = the first in the queue. Upcoming timed tasks are never NU: their
//      time has not come.
//   3. NÆSTE = the earliest upcoming timed task today; otherwise the next in
//      the queue; otherwise the earliest unfinished task on a later day.
//   4. Nothing is shown twice: items in NU/NÆSTE are left out of the
//      overview below them. The overview lists every open timed task in
//      time order (a day's appointments are never cut), then up to
//      REST_LIMIT open untimed tasks in NU order, then every finished one
//      (dimmed, so a tap can be undone).
//
// Timewheel boundary: NU/NÆSTE take items of one shape ({ kind, id,
// title, startTime, durationMinutes, status, … }). The Timewheel and
// Calendar can add timed kinds ('event', 'routine') to the same queues; the
// screen does not change for that. No such items exist yet, and none are
// invented here.
import { groupJournal } from '../../data/tasks.js';
import { scheduleStatus, compareStart, compareDateStart, isTimed } from '../tasks/schedule.js';
import { taskItem, habitItem, dayProgress } from '../tasks/items.js';
import { addDays, isDateKey } from '../../core/time/dates.js';
import { t, formatRelativeDay } from '../../core/i18n/index.js';

/** Goals with a deadline up to this many days ahead, or passed at most this many days ago, need attention. */
export const GOAL_ATTENTION_DAYS = 7;
/** Overview rows before "N more in Plan". */
export const REST_LIMIT = 5;
const GOALS_LIMIT = 3;

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const priorityRank = (p) => PRIORITY_RANK[p] ?? PRIORITY_RANK.medium;

/** Unfinished due tasks in NU order (Array.prototype.sort is stable). */
export function rankDueTasks(tasks) {
  return [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || compareDateStart(a, b));
}

/**
 * Unfinished goals whose 'YYYY-MM-DD' deadline is within
 * GOAL_ATTENTION_DAYS either side of today: due soon first (nearest first),
 * then recently passed ones (most recent first). Goals that passed longer
 * ago are left to the Goals screen, so they do not sit on I dag forever.
 * Compares date keys as strings (local dates), so a deadline of today is
 * "today", not "passed".
 */
export function goalsNeedingAttention(goals, today) {
  const from = addDays(today, -GOAL_ATTENTION_DAYS);
  const to = addDays(today, GOAL_ATTENTION_DAYS);
  const inWindow = goals.filter(g => !g.completed && isDateKey(g.deadline) && g.deadline >= from && g.deadline <= to);
  const upcoming = inWindow.filter(g => g.deadline >= today).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const passed = inWindow.filter(g => g.deadline < today).sort((a, b) => b.deadline.localeCompare(a.deadline));
  return [...upcoming, ...passed]
    .map(g => ({
      id: g.id, title: g.title, deadline: g.deadline,
      progress: g.progress, target: g.target, passed: g.deadline < today,
    }));
}

/**
 * journal: tasks + habits (src/data/tasks.js). keepVisibleIds: tasks ticked
 * during this visit, so a finished overdue task stays (dimmed) and the
 * tap can be undone, same as on Plan.
 *
 * nowMinutes: minutes since today's midnight.
 *
 * Returns { now, next, rest, restMore, habits, goals, shoppingCount,
 * done, total, state } where state is 'active' (there is a NU), 'free'
 * (nothing to do now, but a timed task later today), 'allDone' (everything
 * for today is ticked) or 'empty' (nothing today).
 * done/total: dayProgress (tasks dated today plus habits; the same numbers
 * Plan shows).
 */
export function buildToday({ journal, goals, groceries, today, nowMinutes, keepVisibleIds }) {
  const groups = groupJournal(journal, today, keepVisibleIds);
  // (Parameters are named `task`, not `t`, which is the i18n lookup here.)
  const item = (task) => taskItem(task, today, nowMinutes);
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
  const habitsDone = habits.filter(h => h.done).length;
  const laterDay = groups.Upcoming.filter(task => !task.done).sort(compareDateStart)[0];

  const queue = [...active.map(item), ...flexible.map(item), ...habits.filter(h => !h.done)];
  const now = queue[0] ?? null;
  const next = (upcomingTimed[0] && item(upcomingTimed[0])) ?? queue[1] ?? (laterDay ? item(laterDay) : null);
  const featured = new Set([now, next].filter(Boolean).map(i => i.id));
  const notFeatured = (task) => !featured.has(task.id);

  // Timed tasks are all listed, in time order; only untimed ones are
  // capped. Finished ones always stay listed, so a task ticked in NU/NÆSTE
  // is never pushed out of sight before it can be undone.
  const timedRest = [...active, ...upcomingTimed, ...flexible.filter(isTimed)]
    .filter(notFeatured).sort(compareDateStart);
  const untimedRest = flexible.filter(task => !isTimed(task) && notFeatured(task));
  const rest = [...timedRest, ...untimedRest.slice(0, REST_LIMIT), ...dueDone.filter(notFeatured)].map(item);
  const progress = dayProgress(groups, today);

  return {
    now,
    next,
    rest,
    restMore: Math.max(0, untimedRest.length - REST_LIMIT),
    habits: habits.filter(notFeatured),
    goals: goalsNeedingAttention(goals, today).slice(0, GOALS_LIMIT),
    shoppingCount: groceries.filter(g => !g.done).length,
    done: progress.done,
    total: progress.total,
    state: now ? 'active'
      : upcomingTimed.length > 0 ? 'free'
        : dueDone.length + habitsDone > 0 ? 'allDone' : 'empty',
  };
}

/** 'Frist i morgen · 2 af 5' for a goalsNeedingAttention() entry. */
export function describeGoal(goal, today) {
  const due = goal.passed
    ? t('today.goal.passed')
    : t('today.goal.due', { day: formatRelativeDay(goal.deadline, today) });
  return `${due} · ${t('today.goal.progress', { progress: goal.progress, target: goal.target })}`;
}

/** Danish greeting key for an hour 0–23 (i18n key under today.greeting). */
export function greetingKey(hour) {
  if (hour < 5) return 'today.greeting.night';
  if (hour < 10) return 'today.greeting.morning';
  if (hour < 12) return 'today.greeting.forenoon';
  if (hour < 18) return 'today.greeting.afternoon';
  return 'today.greeting.evening';
}
