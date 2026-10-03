// src/features/today/logic.js
//
// What the I dag screen shows, derived from the stored lists. Pure: the
// date is passed in, nothing is read from the clock and nothing is written.
// Real data only. Without time of day or calendar events there is no
// clock-based "now", so NU is the most important thing to do today.
//
// NU / NÆSTE (deterministic):
//   1. Candidates are the unfinished one-off tasks dated today or earlier,
//      ranked by priority (high, medium, low; missing counts as medium),
//      then by date (oldest first), then the user's own list order;
//      followed by today's unticked habits in list order.
//   2. NU = the first candidate. NÆSTE = the second; if there is none, the
//      earliest unfinished task planned for a later day.
//   3. Nothing is shown twice: items in NU/NÆSTE are left out of the
//      overview below them. The overview lists up to REST_LIMIT more open
//      tasks, then every finished one (dimmed, so a tap can be undone).
//
// Timewheel boundary: NU/NÆSTE take items of one shape ({ kind, id,
// title, … }). The Timewheel and Calendar will add timed kinds ('event',
// 'routine') as candidates ahead of untimed tasks; the screen does not change
// for that. No such items exist yet, and none are invented here.
import { groupJournal } from '../../data/tasks.js';
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
  return [...tasks].sort((a, b) =>
    priorityRank(a.priority) - priorityRank(b.priority) || a.date.localeCompare(b.date));
}

function taskItem(task, today) {
  return {
    kind: 'task',
    id: task.id,
    title: task.text,
    done: Boolean(task.done),
    date: task.date,
    important: task.priority === 'high',
    carriedOver: task.date < today,
    planned: task.date > today,
  };
}

function habitItem(habit, today) {
  return { kind: 'habit', id: habit.id, title: habit.text, icon: habit.icon, done: Boolean(habit.history?.[today]) };
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
 * tap can be undone, same as on the Tasks screen.
 *
 * Returns { now, next, rest, restMore, habits, goals, shoppingCount,
 * done, total, state } where state is 'active' (there is a NU),
 * 'allDone' (everything for today is ticked) or 'empty' (nothing today).
 * done/total is the progress of today's own plan: tasks dated today plus
 * habits. Carried-over tasks are not counted (when they were finished is
 * not stored), so the numbers do not change between visits.
 */
export function buildToday({ journal, goals, groceries, today, keepVisibleIds }) {
  const groups = groupJournal(journal, today, keepVisibleIds);
  // (Parameters are named `task`, not `t`, which is the i18n lookup here.)
  const due = [...groups.Overdue, ...groups.Today];
  const dueOpen = rankDueTasks(due.filter(task => !task.done));
  const dueDone = due.filter(task => task.done);
  const habits = groups.Habits.map(h => habitItem(h, today));
  const habitsDone = habits.filter(h => h.done).length;
  const upcomingOpen = groups.Upcoming.filter(task => !task.done);

  const candidates = [...dueOpen.map(task => taskItem(task, today)), ...habits.filter(h => !h.done)];
  const now = candidates[0] ?? null;
  const next = candidates[1] ?? (upcomingOpen[0] ? taskItem(upcomingOpen[0], today) : null);
  const featured = new Set([now, next].filter(Boolean).map(item => item.id));
  const notFeatured = (task) => !featured.has(task.id);

  // Open tasks are capped; finished ones always stay listed, so a task
  // ticked in NU/NÆSTE is never pushed out of sight before it can be undone.
  const restOpen = dueOpen.filter(notFeatured);
  const rest = [...restOpen.slice(0, REST_LIMIT), ...dueDone.filter(notFeatured)]
    .map(task => taskItem(task, today));

  return {
    now,
    next,
    rest,
    restMore: Math.max(0, restOpen.length - REST_LIMIT),
    habits: habits.filter(notFeatured),
    goals: goalsNeedingAttention(goals, today).slice(0, GOALS_LIMIT),
    shoppingCount: groceries.filter(g => !g.done).length,
    done: groups.Today.filter(task => task.done).length + habitsDone,
    total: groups.Today.length + habits.length,
    state: now ? 'active' : dueDone.length + habitsDone > 0 ? 'allDone' : 'empty',
  };
}

/** The quiet line under an item's title, e.g. 'Fra i går · Vigtig'. */
export function describeItem(item, today) {
  const parts = [];
  if (item.kind === 'habit') parts.push(t('today.meta.habit'));
  if (item.carriedOver) parts.push(t('today.meta.carriedOver', { day: formatRelativeDay(item.date, today) }));
  if (item.planned) parts.push(t('today.meta.planned', { day: formatRelativeDay(item.date, today) }));
  if (item.important) parts.push(t('today.meta.important'));
  return parts.join(' · ');
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
