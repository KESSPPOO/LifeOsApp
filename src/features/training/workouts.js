// src/features/training/workouts.js
//
// The actions that touch more than one training list: start, change,
// finish and discard the workout in progress. A factory over the stores
// (injected), so the rules run under node:test with in-memory storage;
// ./store.js creates the app's instance. See ADR-010.
//
// Safety rules:
// - Never two workouts in progress: starting while one exists returns it.
// - Finishing writes history FIRST and clears the workout in progress only
//   after that save succeeded. If history cannot be saved (unreadable at
//   boot, or the write fails), the workout stays in progress and nothing
//   is lost; pickActive ignores a copy that already reached history.
import { pickActive, startSession, finishSession } from './session.js';

export function createWorkoutActions({ exercisesStore, activeStore, historyStore, newId }) {
  const current = () => pickActive(activeStore.getState().items, historyStore.getState().items);

  return {
    current,

    /** Starts a workout from a template unless one is in progress (then returns that one). */
    start(template, { date, nowMs }) {
      const existing = current();
      if (existing) return existing;
      const session = startSession({ id: newId(), template, exercises: exercisesStore.getState().items, date, nowMs });
      activeStore.getState().setItems([session]);
      return session;
    },

    /** Changes the workout in progress with a pure session -> session function (./session.js). */
    update(fn) {
      const active = current();
      if (!active) return;
      const next = fn(active);
      if (next !== active) activeStore.getState().setItems([next]);
    },

    /** Finishes the workout in progress: { session } or { error } (i18n key; then nothing changed on disk). */
    async finish(nowMs) {
      const active = current();
      if (!active) return { error: 'training.finish.none' };
      const history = historyStore.getState();
      if (!history.hydrated || history.persistBlocked) return { error: 'training.finish.blocked' };
      const done = finishSession(active, nowMs);
      history.setItems(prev => [...prev, done]);
      if (!(await historyStore.getState().flush())) return { error: 'training.finish.blocked' };
      activeStore.getState().setItems([]);
      return { session: done };
    },

    /** Kassér: drops the workout in progress; history is not touched. */
    discard() {
      activeStore.getState().setItems([]);
    },
  };
}
