// src/core/i18n/da.js
//
// Danish UI strings for the new LifeOS shell and modules, looked up with
// t('key') from ./index.js. Flat dotted keys; `{name}` placeholders are
// filled from t()'s params. An entry with { one, other } is chosen by
// params.count (1 -> one).
//
// Used by the new shell, I dag, Plan, Mere and the Danish DatePicker. Legacy
// screens keep their own (English) text until the planned translation
// session.
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
  'today.free.title':    'Intet lige nu',
  'today.free.body':     'Det næste på planen er kl. {time}. Indtil da er tiden din.',
  'today.allDone.title': 'Alt for i dag er klaret',
  'today.allDone.body':  'Resten af dagen er din.',
  'today.goToPlan':      'Gå til Plan',

  'today.progress': '{done} af {total} klaret i dag',
  'today.rest':     'Resten af dagen',
  'today.habits':   'Vaner',
  'today.goals':    'Mål med frist snart',
  'today.restMore': { one: '{count} opgave mere i Plan', other: '{count} opgaver mere i Plan' },
  'today.shopping': '{count} ting på indkøbslisten',

  'today.meta.activeUntil': 'I gang til {time}',
  'today.meta.timePassed':  'Tidspunktet er passeret',
  'today.meta.carriedOver': 'Fra {day}',
  'today.meta.planned':     'Planlagt til {day}',
  'today.meta.important':   'Vigtig',
  'today.meta.habit':       'Vane',

  'today.goal.due':      'Frist {day}',
  'today.goal.passed':   'Fristen er passeret',
  'today.goal.progress': '{progress} af {target}',

  'today.a11y.checkHint':   'Markerer som klaret',
  'today.a11y.uncheckHint': 'Fortryder markeringen',

  // ── Plan ──────────────────────────────────────────────────────────────
  'plan.today':       'I dag',
  'plan.timed':       'Med tidspunkt',
  'plan.flexible':    'Uden tidspunkt',
  'plan.todayEmpty':  'Intet planlagt i dag.',
  'plan.overdue':     'Overskredet',
  'plan.upcoming':    'Kommende',
  'plan.noDate':      'Uden dato',
  'plan.habits':      'Vaner',
  'plan.addHabit':    'Ny vane',
  'plan.empty':       'Ingen opgaver endnu. Skriv en herunder, når du er klar.',
  'plan.reorderHint': 'Hold og træk for at ændre rækkefølgen',
  'plan.active':      'I gang',
  'plan.openHint':    'Åbner for at redigere',
  'plan.streak':      { one: '{count} dag i træk', other: '{count} dage i træk' },
  'plan.week':        '{count} af de sidste 7 dage',
  'plan.clearAll':    'Slet alle opgaver og vaner',
  'plan.clearAllTitle': 'Slet alt',
  'plan.clearAllMessage': { one: '{count} punkt slettes permanent, også vaner og deres historik. Det kan ikke fortrydes.', other: '{count} punkter slettes permanent, også vaner og deres historik. Det kan ikke fortrydes.' },

  'plan.composer.placeholder': 'Tilføj en opgave …',
  'plan.composer.add':         'Tilføj opgave',
  'plan.composer.date':        'Dato: {day}',
  'plan.composer.details':     'Tidspunkt og mere',

  // ── Task form (Plan) ──────────────────────────────────────────────────
  'taskForm.newTask':   'Ny opgave',
  'taskForm.editTask':  'Rediger opgave',
  'taskForm.newHabit':  'Ny vane',
  'taskForm.editHabit': 'Rediger vane',
  'taskForm.title':     'Hvad skal du?',
  'taskForm.habitName': 'Vanens navn',
  'taskForm.icon':      'Ikon',
  'taskForm.category':  'Kategori (valgfri)',
  'taskForm.date':      'Dato',
  'taskForm.today':     'I dag',
  'taskForm.tomorrow':  'I morgen',
  'taskForm.noDate':    'Ingen dato',
  'taskForm.time':      'Tidspunkt (valgfrit)',
  'taskForm.timePlaceholder': 'fx 10.45',
  'taskForm.timeInvalid':     'Skriv tidspunktet som fx 10.45 eller 9.',
  'taskForm.timeNeedsDate':   'Vælg en dato for at give opgaven et tidspunkt.',
  'taskForm.noTime':          'Intet tidspunkt',
  'taskForm.duration':        'Varighed (valgfri)',
  'taskForm.durationUnknown': 'Ved ikke',
  'taskForm.durationCustom':  'Andet',
  'taskForm.durationMinutes': 'Minutter',
  'taskForm.durationInvalid': 'Skriv et helt antal minutter fra 1 til 1440.',
  'taskForm.priority':  'Prioritet',
  'taskForm.save':      'Gem',
  'taskForm.create':    'Opret',
  'taskForm.cancel':    'Annuller',
  'taskForm.delete':    'Slet',
  'taskForm.ok':        'OK',
  'taskForm.missingTitle':  'Skriv, hvad det drejer sig om.',
  'taskForm.deleteTitle':   'Slet',
  'taskForm.deleteMessage': 'Vil du slette »{title}«?',

  'priority.low':    'Lav',
  'priority.medium': 'Mellem',
  'priority.high':   'Høj',

  // ── DatePicker (locale="da") ──────────────────────────────────────────
  'datePicker.today': 'I dag',
  'datePicker.close': 'Luk',
  'datePicker.prev':  'Forrige måned',
  'datePicker.next':  'Næste måned',
  'datePicker.clear': 'Fjern dato',
};
