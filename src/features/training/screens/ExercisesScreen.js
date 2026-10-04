// src/features/training/screens/ExercisesScreen.js
//
// Øvelser: the exercise library. Search by name, filter by broad category,
// open an exercise's Forklaring, create a new exercise or edit one of the
// user's own. Starts empty: no exercise is added without the user.
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';
import { Choice } from '../../../components/Choice';
import { t } from '../../../core/i18n';
import { useExercises } from '../store';
import { CATEGORIES, categoryLabel, muscleLabel, equipmentLabel, filterExercises, findExercise } from '../exercises';
import { useExerciseEditor } from '../useExerciseEditor';
import { ExerciseInfoSheet } from '../components/ExerciseInfoSheet';

export default function ExercisesScreen() {
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [infoId, setInfoId] = useState(null);
  const { openExerciseEditor, exerciseEditorElement } = useExerciseEditor();

  const shown = useMemo(() => filterExercises(exercises, { query, category }), [exercises, query, category]);
  const info = infoId ? findExercise(exercises, infoId) : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => openExerciseEditor(null)} style={styles.newBtn} accessibilityRole="button">
          <Text style={styles.newText}>+ {t('training.exercises.new')}</Text>
        </TouchableOpacity>

        {exercises.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('training.exercises.empty.title')}</Text>
            <Text style={styles.emptyBody}>{t('training.exercises.empty.body')}</Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.search}
              placeholder={t('training.exercises.search')}
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={setQuery}
              accessibilityLabel={t('training.exercises.search')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} keyboardShouldPersistTaps="handled">
              <Choice label={t('training.exercises.all')} selected={category === null} onPress={() => setCategory(null)} />
              {CATEGORIES.filter(c => exercises.some(e => e.category === c)).map(c => (
                <Choice key={c} label={categoryLabel(c)} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </ScrollView>
            {shown.map(exercise => {
              const meta = [categoryLabel(exercise.category), (exercise.muscleGroups ?? []).map(muscleLabel).join(', '), equipmentLabel(exercise.equipment)]
                .filter(Boolean).join(' · ');
              return (
                <TouchableOpacity
                  key={exercise.id}
                  onPress={() => setInfoId(exercise.id)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={`${exercise.name}, ${meta}`}
                  accessibilityHint={t('training.exercises.openHint')}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{exercise.name}</Text>
                    <Text style={styles.meta}>{meta}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
            {shown.length === 0 ? <Text style={styles.emptyBody}>{t('training.exercises.noMatch')}</Text> : null}
          </>
        )}
      </ScrollView>

      {info ? (
        <ExerciseInfoSheet
          exercise={info}
          onEdit={() => { setInfoId(null); openExerciseEditor(info); }}
          onClose={() => setInfoId(null)}
        />
      ) : null}
      {exerciseEditorElement}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  newBtn: {
    alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.border2, marginBottom: 16,
  },
  newText: { fontSize: 16, fontWeight: '600', color: COLORS.text },

  search: {
    backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 12,
    paddingHorizontal: 14, minHeight: 48, color: COLORS.text, fontSize: 16, marginBottom: 12,
  },
  filters: { marginBottom: 8, flexGrow: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  rowText: { flex: 1, paddingRight: 8 },
  name:    { fontSize: 17, fontWeight: '600', color: COLORS.text },
  meta:    { fontSize: 14, color: COLORS.textMuted, marginTop: 3 },
  chevron: { fontSize: 22, color: COLORS.textMuted },

  empty:      { paddingVertical: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptyBody:  { fontSize: 15, lineHeight: 22, color: COLORS.textMuted, marginTop: 6 },
});
