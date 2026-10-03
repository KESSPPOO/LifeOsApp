// src/features/groceries/logic.js
//
// Pure grocery-list operations (no React), moved from GroceriesScreen so they
// can be unit-tested. Same results for valid data; addGrocery additionally
// treats a missing id as 0 (like the tasks code) so one damaged entry cannot
// make every new id NaN. A grocery item is
// { id: number, text: string, category: string, done: boolean }, stored as a
// plain array under `lifeos_groceries`.

export const GROCERY_CATEGORIES = ['supermarket', 'pharmacy', 'home', 'other'];

export function toggleGrocery(list, id) {
  return list.map(item => item.id === id ? { ...item, done: !item.done } : item);
}

export function deleteGrocery(list, id) {
  return list.filter(item => item.id !== id);
}

/** New items go to the top of the list, with id = highest id + 1. */
export function addGrocery(list, text, category) {
  const newId = Math.max(0, ...list.map(s => s.id || 0)) + 1;
  return [{ id: newId, text, category, done: false }, ...list];
}

/** filter: 'all' | 'to buy' | 'completed' */
export function filterGroceries(list, filter) {
  return list.filter(item => {
    if (filter === 'to buy') return !item.done;
    if (filter === 'completed') return item.done;
    return true;
  });
}
