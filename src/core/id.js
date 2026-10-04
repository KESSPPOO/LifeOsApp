// src/core/id.js
//
// Ids for records that refer to each other (routines and their logs,
// exercises, templates, workouts): time + random, never reused after a
// delete (unlike the legacy max(id)+1). Impure: screens and store actions
// call it and pass the id into the pure logic, which never generates ids.
export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
