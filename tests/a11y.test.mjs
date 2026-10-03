// Accessibility checks for the new shell, I dag and Mere (not the legacy
// screens): WCAG contrast of the colour pairs they use, and no tiny text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../src/config/colors.js';

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url));

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('text colours used by the new UI reach 4.5:1 on its backgrounds', () => {
  for (const fg of ['text', 'textMuted']) {
    for (const bg of ['bg', 'bg2', 'bgElevated']) {
      assert.ok(contrast(COLORS[fg], COLORS[bg]) >= 4.5, `${fg} on ${bg}: ${contrast(COLORS[fg], COLORS[bg]).toFixed(2)}`);
    }
  }
  // The check mark on green.
  assert.ok(contrast(COLORS.bg, COLORS.green) >= 4.5, 'check mark');
  // The empty checkbox ring is a UI component: 3:1.
  assert.ok(contrast(COLORS.textMuted, COLORS.bgElevated) >= 3, 'checkbox ring');
});

test('textSub, and accent on the bottom bar, fail 4.5:1, so the new UI avoids them for text', () => {
  assert.ok(contrast(COLORS.textSub, COLORS.bg) < 4.5);
  assert.ok(contrast(COLORS.accent, COLORS.bg2) < 4.5);
  const bar = readFileSync(path('../src/app/navigation/BottomNav.js'), 'utf8');
  assert.match(bar, /bottomNavLabelActive: \{ color: COLORS\.text\b/);
});

const NEW_UI = [
  '../src/features/today/screens/TodayScreen.js',
  '../src/features/today/components/CheckButton.js',
  '../src/app/navigation/MoreScreen.js',
  '../src/app/navigation/ShellLayout.js',
  '../src/app/navigation/BottomNav.js',
  '../src/components/HeaderBar.js',
];

test('new UI files: no text below 12 pt, no textSub', () => {
  // Every screen/component under features/today is covered by the list.
  for (const dir of ['screens', 'components']) {
    for (const f of readdirSync(path(`../src/features/today/${dir}`))) {
      assert.ok(NEW_UI.includes(`../src/features/today/${dir}/${f}`), `${f} is checked`);
    }
  }
  for (const rel of NEW_UI) {
    const src = readFileSync(path(rel), 'utf8');
    for (const m of src.matchAll(/fontSize:\s*(\d+)/g)) assert.ok(Number(m[1]) >= 12, `${rel}: fontSize ${m[1]}`);
    assert.ok(!src.includes('COLORS.textSub'), `${rel} uses textSub`);
  }
});

test('interactive elements in the new UI declare a role', () => {
  for (const rel of NEW_UI) {
    const src = readFileSync(path(rel), 'utf8');
    const touchables = (src.match(/<TouchableOpacity\b/g) || []).length;
    const roles = (src.match(/accessibilityRole="(button|checkbox|tab)"/g) || []).length;
    assert.ok(roles >= touchables, `${rel}: ${touchables} touchables, ${roles} roles`);
  }
});
