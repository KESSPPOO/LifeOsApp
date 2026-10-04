// src/features/today/logic.js
//
// What the I dag screen shows, derived from the stored lists. Pure: the
// date and time ("now") are passed in, nothing is read from the clock and
// nothing is written. Real data only.
//
// NU / NÆSTE come from selectFocus (src/features/tasks/focus.js), the
// rule Timewheel uses too. This file adds the rest of the screen:
//   - Nothing is shown twice: items in NU/NÆSTE are left out of the
//     overview below them. The overview lists every open timed task in
//     time order (a day's appointments are never cut), then up to
//     REST_LIMIT open untimed tasks in NU order, then every finished one
//     (dimmed, so a tap can be undone).
//   - Goals near their deadline, the shopping count, progress, and the
//     calm state of the day.
//
// NU/NÆSTE take items of one shape ({ kind, id, title, startTime,
// durationMinutes, status, … }); a Calendar can later add timed kinds
// ('event', 'routine') to the same queues. None are invented here.
import { compareDateStart, isTimed } from '../tasks/schedule.js';
import { taskItem, dayProgress } from '../tasks/items.js';
import { selectFocus } from '../tasks/focus.js';
import { routineItemsOn } from '../routines/model.js';
import { addDays, isDateKey } from '../../core/time/dates.js';
import { t, formatRelativeDay } from '../../core/i18n/index.js';

/** Goals with a deadline up to this many days ahead, or passed at most this many days ago, need attention. */
export const GOAL_ATTENTION_DAYS = 7;
/** Overview rows before "N more in Plan". */
export const REST_LIMIT = 5;
const GOALS_LIMIT = 3;

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
 * routines / routineLog: the routine templates and completion log (default
 * none); today's occurrences take part in NU/NÆSTE, and the others are
 * listed in `routines` (I dag's RUTINER section).
 *
 * Returns { now, next, rest, restMore, habits, routines, goals,
 * shoppingCount, done, total, state } where state is 'active' (there is a NU), 'free'
 * (nothing to do now, but a timed task later today), 'allDone' (everything
 * for today is ticked) or 'empty' (nothing today).
 * done/total: dayProgress (tasks dated today plus habits; the same numbers
 * Plan shows).
 */
export function buildToday({ journal, goals, groceries, today, nowMinutes, keepVisibleIds, routines = [], routineLog = [] }) {
  const routineItems = routineItemsOn(routines, routineLog, today, today, nowMinutes);
  const { now, next, groups, active, upcomingTimed, flexible, dueDone, habits } =
    selectFocus({ journal, today, nowMinutes, keepVisibleIds, routineItems });
  // (Parameters are named `task`, not `t`, which is the i18n lookup here.)
  const item = (task) => taskItem(task, today, nowMinutes);
  const habitsDone = habits.filter(h => h.done).length;
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
    routines: routineItems.filter(notFeatured),
    goals: goalsNeedingAttention(goals, today).slice(0, GOALS_LIMIT),
    shoppingCount: groceries.filter(g => !g.done).length,
    done: progress.done,
    total: progress.total,
    state: now ? 'active'
      : next?.status === 'upcoming' && next.date === today ? 'free'
        : dueDone.length + habitsDone + routineItems.filter(r => r.done).length > 0 ? 'allDone' : 'empty',
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
