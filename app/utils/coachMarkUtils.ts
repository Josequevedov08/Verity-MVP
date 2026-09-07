/**
 * coachMarkUtils.ts
 * ---------------------------------------------------------------------------
 * Persistencia mínima de "¿ya vio el recorrido guiado de esta pantalla?",
 * una entrada por pantalla (independiente del onboarding de 3 pasos, que
 * es una sola vez para toda la app). Igual que el onboarding, vive en
 * AsyncStorage — no hay servidor.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CoachMarkScreenId = 'capture' | 'certificates' | 'verification';

const KEY_PREFIX = 'verity_coachmark_seen_';

export async function hasSeenCoachMark(screenId: CoachMarkScreenId): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY_PREFIX + screenId);
  return value === 'true';
}

export async function markCoachMarkSeen(screenId: CoachMarkScreenId): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + screenId, 'true');
}

/** Usado desde Ajustes → "Modo de uso" → "Ver la guía de nuevo". */
export async function resetAllCoachMarks(): Promise<void> {
  const ids: CoachMarkScreenId[] = ['capture', 'certificates', 'verification'];
  await Promise.all(ids.map((id) => AsyncStorage.removeItem(KEY_PREFIX + id)));
}
