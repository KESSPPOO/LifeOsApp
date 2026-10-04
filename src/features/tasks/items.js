// src/features/tasks/items.js
//
// How a task, habit or routine occurrence is presented: item shapes and
// one Danish description, shared by I dag, Plan and Tidshjul so the
// screens always agree on an item's state ("I gang til 11:45", "Fra i går",
// "2 af 5 trin", …). Pure; "now" is passed in. (Routine items are built in
// src/features/routines/model.js.)
import { getSchedule, scheduleStatus, endTime } from './schedule.js';
import { minutesToTime } from '../../core/time/timeOfDay.js';
import { t, formatRelativeDay, formatDuration } from '../../core/i18n/index.js';

/** '10:45' or '10:45 · 1 time'; '' for an untimed task. */
export function scheduleLabel(task) {
  const schedule = getSchedule(task);
  if (!schedule) return '';
  const start = minutesToTime(schedule.start);
  return schedule.duration ? `${start} · ${formatDuration(schedule.duration)}` : start;
}

/**
 * { kind: 'task', id, title, done, date, startTime, durationMinutes,
 *   endTime, timeLabel, status, important, carriedOver, planned }.
 * Schedule fields are null for an untimed task; status is
 * scheduleStatus() at (today, nowMinutes).
 */
export function taskItem(task, today, nowMinutes) {
  const schedule = getSchedule(task);
  return {
    kind: 'task',
    id: task.id,
    title: task.text,
    done: Boolean(task.done),
    date: task.date,
    startTime: schedule ? task.startTime : null,
    durationMinutes: schedule?.duration ?? null,
    endTime: endTime(task),
    timeLabel: scheduleLabel(task),
    status: scheduleStatus(task, today, nowMinutes),
    important: task.priority === 'high',
    carriedOver: task.date < today,
    planned: task.date > today,
  };
}

export function habitItem(habit, today) {
  return { kind: 'habit', id: habit.id, title: habit.text, icon: habit.icon, done: Boolean(habit.history?.[today]) };
}

/** A routine occurrence's progress: 'Ikke startet', '2 af 5 trin' or 'Klaret'. */
export function describeRoutineProgress(item) {
  if (item.state === 'complete') return t('routine.complete');
  if (item.state === 'notStarted') return t('routine.notStarted');
  return t('routine.progress', { done: item.doneCount, total: item.stepCount });
}

/**
 * The quiet line under an item's title, e.g. 'I gang til 11:45',
 * 'Fra i går · Vigtig' or 'Rutine · 2 af 5 trin'. (The time itself is
 * item.timeLabel.) Plan lists later tasks under their day, so it passes
 * plannedDay: false.
 */
export function describeItem(item, today, { plannedDay = true } = {}) {
  const parts = [];
  if (item.kind === 'habit') parts.push(t('task.meta.habit'));
  if (item.kind === 'routine') parts.push(t('routine.kind'), describeRoutineProgress(item));
  if (!item.done && item.status === 'active') parts.push(t('task.meta.activeUntil', { time: item.endTime }));
  if (!item.done && item.status === 'past' && item.date === today) parts.push(t('task.meta.timePassed'));
  if (item.carriedOver) parts.push(t('task.meta.carriedOver', { day: formatRelativeDay(item.date, today) }));
  if (item.planned && plannedDay) parts.push(t('task.meta.planned', { day: formatRelativeDay(item.date, today) }));
  if (item.important) parts.push(t('task.meta.important'));
  return parts.join(' · ');
}

/**
 * "X af Y klaret i dag", the same on I dag and Plan: the tasks dated today
 * plus all habits (ticked today). Carried-over tasks are not counted: when
 * they were finished is not stored, so counting them would change the
 * numbers between visits. `groups` is groupJournal()'s result.
 */
export function dayProgress(groups, today) {
  return {
    done: groups.Today.filter(task => task.done).length + groups.Habits.filter(h => h.history?.[today]).length,
    total: groups.Today.length + groups.Habits.length,
  };
}

