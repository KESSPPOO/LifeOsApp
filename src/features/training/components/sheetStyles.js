// src/features/training/components/sheetStyles.js
//
// The look of Training's bottom sheets (the same as the task and routine
// sheets: title, labels, inputs, error, Annuller / primary button), shared
// by the exercise form, the exercise picker, Forklaring, the finish
// summary and a workout in history.
import { StyleSheet } from 'react-native';
import { COLORS } from '../../../config/colors';

export const sheetStyles = StyleSheet.create({
  wrapper:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  title:    { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16, textAlign: 'center' },
  label:    { fontSize: 14, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border2, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
    color: COLORS.text, fontSize: 16, marginBottom: 12,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  error:   { fontSize: 15, color: COLORS.text, backgroundColor: COLORS.redDim, borderRadius: 10, padding: 12, marginBottom: 12 },

  buttons:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  secondaryBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  cancelText:   { fontSize: 16, color: COLORS.textMuted },
  linkText:     { fontSize: 16, color: COLORS.text, textDecorationLine: 'underline' },
  deleteText:   { fontSize: 16, color: COLORS.red, fontWeight: '600' },
  primaryBtn:   { minHeight: 48, justifyContent: 'center', backgroundColor: COLORS.accentDim, paddingHorizontal: 28, borderRadius: 12 },
  primaryText:  { fontSize: 16, color: COLORS.text, fontWeight: '700' },
  bottomSpace:  { height: 20 },
});
