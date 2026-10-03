// src/core/i18n/da.js
//
// Danish UI strings for the new LifeOS shell and modules, looked up with
// t('key') from ./index.js. Flat dotted keys; `{name}` placeholders are
// filled from t()'s params. An entry with { one, other } is chosen by
// params.count (1 -> one).
//
// Only the new shell, I dag and Mere use this so far. Legacy screens keep
// their own (English) text until the planned translation session.
export const da = {
  // ── Navigation (src/config/nav.js) ────────────────────────────────────
  'nav.today':     'I dag',
  'nav.plan':      'Plan',
  'nav.more':      'Mere',
  'nav.groceries': 'Indkøb',
  'nav.goals':     'Mål',
  'nav.notes':     'Noter',
  'nav.stats':     'Statistik',
  'nav.links':     'Links',
  'nav.finances':  'Økonomi',
  'nav.uni':       'Universitet',
  'nav.home':      'Gammel forside',

  // ── Shell ─────────────────────────────────────────────────────────────
  'shell.back':     'Tilbage',
  'shell.backHint': 'Går til den forrige skærm',

  // ── Mere ──────────────────────────────────────────────────────────────
  'more.life':       'Livet',
  'more.tools':      'Værktøjer',
  'more.legacy':     'Ældre skærme',
  'more.legacyNote': 'Fra den oprindelige app. De er endnu ikke oversat til dansk.',

  // ── I dag ─────────────────────────────────────────────────────────────
  'today.greeting.night':     'Hej',
  'today.greeting.morning':   'God morgen',
  'today.greeting.forenoon':  'God formiddag',
  'today.greeting.afternoon': 'God eftermiddag',
  'today.greeting.evening':   'God aften',
  'today.greetingName':       '{greeting}, {name}',
  'today.week':               'Uge {week}',

  'today.now':  'Nu',
  'today.next': 'Næste',

  'today.empty.title':   'Intet presserende lige nu',
  'today.empty.body':    'Der ligger ingen opgaver til i dag. Du kan tilføje en i Plan, når du har overskud.',
  'today.allDone.title': 'Alt for i dag er klaret',
  'today.allDone.body':  'Resten af dagen er din.',
  'today.goToPlan':      'Gå til Plan',

  'today.progress': '{done} af {total} klaret i dag',
  'today.rest':     'Resten af dagen',
  'today.habits':   'Vaner',
  'today.goals':    'Mål med frist snart',
  'today.restMore': { one: '{count} opgave mere i Plan', other: '{count} opgaver mere i Plan' },
  'today.shopping': '{count} ting på indkøbslisten',

  'today.meta.carriedOver': 'Fra {day}',
  'today.meta.planned':     'Planlagt til {day}',
  'today.meta.important':   'Vigtig',
  'today.meta.habit':       'Vane',

  'today.goal.due':      'Frist {day}',
  'today.goal.passed':   'Fristen er passeret',
  'today.goal.progress': '{progress} af {target}',

  'today.a11y.checkHint':   'Markerer som klaret',
  'today.a11y.uncheckHint': 'Fortryder markeringen',
};
