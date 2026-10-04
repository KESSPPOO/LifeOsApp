// src/app/confirmDelete.js
//
// The Danish "are you sure?" dialog for deleting something, as a
// CustomAlert config (src/components/CustomAlert.js): Annuller (cancel,
// also Android Back) and a destructive confirm button. Used by the task
// editor, Plan's "Slet alle" and the routine editor, so every delete asks
// the same way. close() hides the dialog; onConfirm runs before it.
import { t } from '../core/i18n';

export function confirmDelete({ title = t('taskForm.delete'), message, confirmText = t('taskForm.delete'), onConfirm, close }) {
  return {
    title,
    message,
    buttons: [
      { text: t('taskForm.cancel'), style: 'cancel', onPress: close },
      { text: confirmText, style: 'destructive', onPress: () => { onConfirm(); close(); } },
    ],
  };
}
