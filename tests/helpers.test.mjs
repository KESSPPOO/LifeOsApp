// Unit tests for src/data/helpers.js — run with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDateKey, gradeWeight, gradeLabel, calculateAverages, predictedDegreeGrade,
  last7Days, fmtTimer,
} from '../src/data/helpers.js';

test('localDateKey uses local calendar fields, zero-padded', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05');
  // Local midnight must never roll back a day (the toISOString() bug).
  assert.equal(localDateKey(new Date(2026, 5, 1, 0, 30)), '2026-06-01');
});

test('last7Days ends today and is in ascending order', () => {
  const days = last7Days();
  assert.equal(days.length, 7);
  assert.equal(days[6], localDateKey(new Date()));
  assert.deepEqual([...days].sort(), days);
});

test('gradeWeight treats 31 (30L) as 30 and never returns NaN', () => {
  assert.equal(gradeWeight(31), 30);
  assert.equal(gradeWeight(24), 24);
  for (const bad of [null, undefined, '', 'abc', 17, 32]) assert.equal(gradeWeight(bad), 0);
});

test('gradeLabel shows 30L for 31', () => {
  assert.equal(gradeLabel(31), '30L');
  assert.equal(gradeLabel(18), '18');
  assert.equal(gradeLabel(null), null);
});

test('calculateAverages ignores exams without a valid achieved grade', () => {
  const exams = [
    { achievedGrade: 30, credits: 6 },
    { achievedGrade: 24, credits: 12 },
    { achievedGrade: null, credits: 9 },
    { achievedGrade: 'bad', credits: 9 },
  ];
  const { average, weightedAverage } = calculateAverages(exams);
  assert.equal(average, 27);
  assert.equal(weightedAverage, 26);
  assert.deepEqual(calculateAverages([]), { average: 0, weightedAverage: 0 });
});

test('predictedDegreeGrade is 0 below 18 and capped at 110', () => {
  assert.equal(predictedDegreeGrade(0), 0);
  assert.equal(predictedDegreeGrade(17), 0);
  assert.equal(predictedDegreeGrade(30), 110);
});

test('fmtTimer formats seconds as HH:MM:SS', () => {
  assert.equal(fmtTimer(3661), '01:01:01');
});
