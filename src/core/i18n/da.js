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
  'nav.timewheel': 'Tidshjul',
  'nav.plan':      'Plan',
  'nav.routines':  'Rutiner',
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

  'today.rest':     'Resten af dagen',
  'today.routines': 'Rutiner',
  'today.habits':   'Vaner',
  'today.goals':    'Mål med frist snart',
  'today.restMore': { one: '{count} opgave mere i Plan', other: '{count} opgaver mere i Plan' },
  'today.shopping': '{count} ting på indkøbslisten',


  'today.goal.due':      'Frist {day}',
  'today.goal.passed':   'Fristen er passeret',
  'today.goal.progress': '{progress} af {target}',


  // ── Tasks and habits (shared by I dag and Plan) ──────────────────────
  'task.meta.activeUntil': 'I gang til {time}',
  'task.meta.timePassed':  'Tidspunktet er passeret',
  'task.meta.carriedOver': 'Fra {day}',
  'task.meta.planned':     'Planlagt til {day}',
  'task.meta.important':   'Vigtig',
  'task.meta.habit':       'Vane',
  'task.progress':         '{done} af {total} klaret i dag',
  'task.a11y.checkHint':   'Markerer som klaret',
  'task.a11y.uncheckHint': 'Fortryder markeringen',

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
  'plan.reorderHint': 'Hold og træk for at flytte opgaver uden tidspunkt, opgaver uden dato og vaner.',
  'plan.openHint':    'Åbner for at redigere',
  'plan.streak':      { one: '{count} dag i træk', other: '{count} dage i træk' },
  'plan.week':        '{count} af de sidste 7 dage',
  'plan.clearAll':    'Slet alle opgaver og vaner',
  'plan.clearAllTitle': 'Slet alt',
  'plan.clearAllMessage': { one: '{count} punkt slettes permanent, også vaner og deres historik. Det kan ikke fortrydes.', other: '{count} punkter slettes permanent, også vaner og deres historik. Det kan ikke fortrydes.' },

  'plan.composer.placeholder': 'Tilføj en opgave …',
  'plan.composer.add':         'Tilføj opgave',
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
  'taskForm.durationInvalid': 'Skriv et helt antal minutter fra 1 til {max}.',
  'taskForm.priority':  'Prioritet',
  'taskForm.save':      'Gem',
  'taskForm.create':    'Opret',
  'taskForm.cancel':    'Annuller',
  'taskForm.delete':    'Slet',
  'taskForm.missingTitle':  'Skriv, hvad det drejer sig om.',
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

  // ── Tidshjul (Timewheel) ──────────────────────────────────────────────
  'timewheel.prevDay':     'Forrige dag',
  'timewheel.nextDay':     'Næste dag',
  'timewheel.backToToday': 'I dag',
  'timewheel.backToTodayHint': 'Viser i dag igen',
  'timewheel.first':       'Første planlagte',
  'timewheel.nothingNow':  'Intet lige nu',
  'timewheel.pastSummary': '{done} af {total} med tidspunkt blev klaret',
  'timewheel.timeline':    'Tidslinje',
  'timewheel.nowMarker':   'Nu · {time}',
  'timewheel.free':        'Fri · {duration}',
  'timewheel.point':       'Uden varighed',
  'timewheel.fromYesterday': 'fortsat fra i går',
  'timewheel.untilTomorrow': 'slutter i morgen',
  'timewheel.done':        'klaret',
  'timewheel.active':      'i gang',
  'timewheel.overlapsWith': 'overlapper med {titles}',
  'timewheel.openHint':    'Åbner opgaven',
  'timewheel.allDone':     'Alt med tidspunkt er klaret.',

  'timewheel.empty.title':  'Intet planlagt med tidspunkt',
  'timewheel.empty.open':   'Din dag er åben.',
  'timewheel.empty.past':   'Der var intet med tidspunkt den dag.',
  'timewheel.empty.flexible': 'Dagen har kun opgaver uden tidspunkt.',

  'timewheel.flexibleToday': 'Fleksibelt i dag',
  'timewheel.flexibleDay':   'Uden tidspunkt den dag',
  'timewheel.flexibleCount': { one: '1 opgave uden tidspunkt', other: '{count} opgaver uden tidspunkt' },
  'timewheel.seeInPlan':     'Se i Plan',

  'timewheel.conflicts':     '{count} ting overlapper',
  'timewheel.conflictsHint': 'Intet flyttes automatisk. Du bestemmer.',
  'timewheel.showConflicts': 'Vis hvilke',
  'timewheel.hideConflicts': 'Skjul',
  'timewheel.open':          'Åbn',
  'timewheel.move':          'Flyt',
  'timewheel.openLabel':     'Åbn {title}',
  'timewheel.moveLabel':     'Flyt {title} til et andet tidspunkt',

  'timewheel.a11y.at':      'klokken {time}',
  'timewheel.a11y.range':   'fra {start} til {end}',
  'timewheel.a11y.ring':    { one: 'Døgnoversigt med 1 ting med tidspunkt', other: 'Døgnoversigt med {count} ting med tidspunkt' },
  'timewheel.a11y.ringNow': 'Klokken er {time}',

  // ── Rutiner ───────────────────────────────────────────────────────────
  'routine.kind':        'Rutine',
  'routine.notStarted':  'Ikke startet',
  'routine.progress':    '{done} af {total} trin',
  'routine.complete':    'Klaret',
  'routine.stepCount':   '{count} trin',
  'routine.paused':      'På pause',
  'routine.openHint':    'Åbner dagens tjekliste',
  'routine.days.everyDay': 'Hver dag',
  'routine.days.weekdays': 'Hverdage',
  'routine.days.weekend':  'Weekend',


  'routines.new':        'Ny rutine',
  'routines.empty.title': 'Du har ingen rutiner endnu',
  'routines.empty.body':  'En rutine er en fast række trin, fx om morgenen. Den vises i I dag og Tidshjul på de dage, du vælger.',
  'routines.today':      'I dag: {progress}',
  'routines.openToday':  'Åbn i dag',
  'routines.openTodayLabel': 'Åbn dagens tjekliste for {name}',
  'routines.editHint':   'Åbner rutinen til redigering',
  'routines.all':        'Alle rutiner',

  'routine.form.newTitle':    'Ny rutine',
  'routine.form.editTitle':   'Rediger rutine',
  'routine.form.name':        'Navn',
  'routine.form.namePlaceholder': 'fx Morgenrutine',
  'routine.form.days':        'Dage',
  'routine.form.steps':       'Trin',
  'routine.form.addStep':     'Tilføj trin',
  'routine.form.stepLabel':   'Trin {n}',
  'routine.form.moveUp':      'Flyt »{text}« op',
  'routine.form.moveDown':    'Flyt »{text}« ned',
  'routine.form.removeStep':  'Fjern »{text}«',
  'routine.form.status':      'Status',
  'routine.form.active':      'Aktiv',
  'routine.form.missingName': 'Giv rutinen et navn.',
  'routine.form.missingDays': 'Vælg mindst én dag.',
  'routine.form.missingSteps': 'Tilføj mindst ét trin.',
  'routine.form.deleteMessage': 'Vil du slette rutinen »{name}«? Det, du har krydset af tidligere, bliver gemt.',

  'routine.checklist.done':  'Færdig',
  'routine.checklist.edit':  'Rediger rutinen',
};
