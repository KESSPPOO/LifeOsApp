// src/features/tasks/items.js
//
// How a task or habit is presented: one item shape and one Danish
// description, shared by I dag and Plan so the two screens always agree on
// a task's state ("I gang til 11:45", "Fra i går", …). Pure; "now" is
// passed in.
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

/**
 * The quiet line under an item's title, e.g. 'I gang til 11:45' or
 * 'Fra i går · Vigtig'. (The time itself is item.timeLabel.) Plan lists
 * later tasks under their day, so it passes plannedDay: false.
 */
export function describeItem(item, today, { plannedDay = true } = {}) {
  const parts = [];
  if (item.kind === 'habit') parts.push(t('task.meta.habit'));
  if (!item.done && item.status === 'active') parts.push(t('task.meta.activeUntil', { time: item.endTime }));
  if (!item.done && item.status === 'past' && item.date === today) parts.push(t('task.meta.timePassed'));
  if (item.carriedOver) parts.push(t('task.meta.carriedOver', { day: formatRelativeDay(item.date, today) }));
  if (item.planned && plannedDay) parts.push(t('task.meta.planned', { day: formatRelativeDay(item.date, today) }));
  if (item.important) parts.push(t('task.meta.important'));
  return parts.join(' · ');
}
