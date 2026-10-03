// src/features/goals/logic.js
//
// Pure goal operations (no React), moved from GoalsScreen so they can be
// unit-tested. Results are identical to the old inline code. A goal is
// { id, title, description, target, progress, category, priority, deadline,
//   completed }, stored as a plain array under `lifeos_goals`.
//
// Note (unchanged behaviour, see docs/LIFEOS_PLAN.md § 3): the "expired" check
// parses the 'YYYY-MM-DD' deadline with new Date(), i.e. as UTC midnight.

export const GOAL_CATEGORIES = ['Study', 'Sport', 'Finance', 'Health', 'Personal', 'Work'];
export const GOAL_FILTERS    = ['All', 'Active', 'Completed', 'Expired'];

/** Numeric form input; accepts a comma decimal ("2,5"). Invalid -> 0. */
export function parseGoalNumber(text) {
  return parseFloat(text.replace(',', '.')) || 0;
}

// Progress always stays within 0..target.
function clampProgress(target, value) {
  return Math.max(0, Math.min(target, value));
}

/**
 * fields: { title, description, target, progress, category, priority, deadline }
 * with title/description/deadline already trimmed and numbers parsed.
 */
function goalFields({ title, description, target, progress, category, priority, deadline }) {
  return {
    title, description, target,
    progress: clampProgress(target, progress),
    category, priority, deadline,
    completed: progress >= target,
  };
}

/** New goals go to the top, with id = highest id + 1. */
export function addGoal(list, fields) {
  const newId = Math.max(0, ...list.map(o => o.id || 0)) + 1;
  return [{ id: newId, ...goalFields(fields) }, ...list];
}

export function updateGoal(list, id, fields) {
  return list.map(o => o.id === id ? { ...o, ...goalFields(fields) } : o);
}

/** The −/+ stepper and the "Complete" button (delta = target − progress). */
export function stepGoalProgress(list, id, delta) {
  return list.map(o => {
    if (o.id !== id) return o;
    const newVal = clampProgress(o.target, o.progress + delta);
    return { ...o, progress: newVal, completed: newVal >= o.target };
  });
}

/** The inline progress field (raw text, comma decimals accepted). */
export function setGoalProgress(list, id, text) {
  return list.map(o => {
    if (o.id !== id) return o;
    const v = parseGoalNumber(text);
    return { ...o, progress: clampProgress(o.target, v), completed: v >= o.target };
  });
}

export function deleteGoal(list, id) {
  return list.filter(o => o.id !== id);
}

/**
 * `now` is passed in (a Date) so this stays deterministic. Returns a real
 * boolean: the old inline version returned '' for a goal without deadline,
 * which the screen then rendered as a bare string inside a <View>.
 */
export function isGoalExpired(goal, now) {
  return Boolean(goal.deadline) && !goal.completed && new Date(goal.deadline) < now;
}

/** filter: one of GOAL_FILTERS. */
export function filterGoals(list, filter, now) {
  return list.filter(o => {
    if (filter === 'Active') return !o.completed;
    if (filter === 'Completed') return o.completed;
    if (filter === 'Expired') return isGoalExpired(o, now);
    return true;
  });
}
