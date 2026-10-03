// src/data/tasks.js
//
// Pure (React-free) logic for the unified tasks + habits list stored under
// the 'journal' key. A one-off task has `recurring: false` and an optional
// 'YYYY-MM-DD' `date`; a habit has `recurring: true`, a `history` map of
// 'YYYY-MM-DD' -> 1 and a cached `streak`. Kept free of React Native imports
// so it can be unit-tested with `npm test` (hence the explicit `.js` in the
// import below: Node's ESM resolver needs it, Metro accepts it too).
import { localDateKey } from './helpers.js';

// Display order of the sections on the Tasks screen.
export const TASK_SECTIONS = ['Overdue', 'Today', 'Upcoming', 'Habits', 'No Date'];

// Consecutive days with a `history` entry, counting back from `today`
// ('YYYY-MM-DD'). Today itself not being done yet does not break the streak
// (the day isn't over). Used both when toggling a habit and when building
// seed data, so a seeded streak matches what a real tap would produce.
// Counts from the given `today`, not the wall clock, so a screen rendered
// just before midnight and tapped just after still gets a consistent result.
export function computeStreak(history, today) {
  let streak = 0;
  const [y, m, day] = today.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  while (true) {
    const dateStr = localDateKey(d);
    if (history[dateStr]) { streak++; d.setDate(d.getDate() - 1); }
    else if (dateStr === today) { d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// The tap on a task's checkbox or a habit's "today" circle. One-off task:
// flips `done`. Habit: toggles today in `history` and recomputes the cached
// `streak`. Returns a new list; entries other than `id` are untouched.
export function toggleJournalEntry(journal, id, today) {
  return journal.map(t => {
    if (t.id !== id) return t;
    if (!t.recurring) return { ...t, done: !t.done };

    const history = { ...(t.history || {}) };
    if (history[today]) delete history[today];
    else history[today] = 1;

    return { ...t, history, streak: computeStreak(history, today) };
  });
}

// Groups the journal into TASK_SECTIONS for the Tasks screen.
//
// 'Overdue' = not-done one-off tasks dated before today. Previously no
// section matched them at all, so an unfinished task silently disappeared
// from the Tasks screen the day after its date (while Home still listed it
// as overdue) and could no longer be completed, edited or deleted. Done
// past-dated tasks stay out of the list, as before — they still count in
// Home and Stats — except ids in `keepVisibleIds`: the screen passes the
// tasks ticked off during the current visit, so a task completed from the
// Overdue section stays (dimmed) where it was and an accidental tap can be
// undone, instead of vanishing on the spot.
export function groupJournal(journal, today, keepVisibleIds = new Set()) {
  const habits  = journal.filter(t => t.recurring);
  const oneTime = journal.filter(t => !t.recurring);

  const overdueItems  = oneTime.filter(t => t.date && t.date < today && (!t.done || keepVisibleIds.has(t.id)));
  const todayItems    = oneTime.filter(t => t.date === today);
  const upcomingItems = oneTime.filter(t => t.date && t.date > today);
  const noDateItems   = oneTime.filter(t => !t.date);

  // Within each section: not-done first, done items sink to the bottom
  // and stay visible but dimmed (Microsoft To Do style). Array sort is
  // stable, so the user's drag order is otherwise preserved.
  const sortDone = (list) => [...list].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));

  return {
    Overdue: sortDone(overdueItems),
    Today: sortDone(todayItems),
    Upcoming: upcomingItems.sort((a, b) => a.date.localeCompare(b.date)),
    Habits: habits,
    'No Date': sortDone(noDateItems),
  };
}
