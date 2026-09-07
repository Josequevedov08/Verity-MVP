/**
 * coachMarkUtils.ts
 * ---------------------------------------------------------------------------
 * Persistencia mínima de "¿ya vio el recorrido guiado de esta pantalla?",
 * una entrada por pantalla (independiente del onboarding de 3 pasos, que
 * es una sola vez para toda la app). Igual que el onboarding, vive en
 * AsyncStorage — no hay servidor.
 */
import { useEffect, useState } from 'react';
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

/**
 * Aviso en memoria (no AsyncStorage) de "se reinició la guía, revisen
 * de nuevo". Necesario porque las 3 pestañas de React Navigation se
 * quedan MONTADAS de fondo una vez visitadas (no se desmontan al
 * cambiar de pestaña) — su `useEffect` que revisa AsyncStorage al
 * montar ya corrió una sola vez y no vuelve a correr solo. Sin esto,
 * tocar "Ver la guía de nuevo" no tenía ningún efecto visible hasta
 * volver a instalar la app: cambiar el valor en AsyncStorage no hace
 * que una pantalla ya montada se vuelva a preguntar por su propio
 * estado.
 */
let resetVersion = 0;
const listeners = new Set<() => void>();

/** Cada pantalla se suscribe con esto — cuando cambia, vuelve a
 * revisar si debe mostrar su recorrido guiado, sin importar si ya
 * estaba montada. */
export function useCoachMarkResetVersion(): number {
  const [version, setVersion] = useState(resetVersion);
  useEffect(() => {
    const listener = () => setVersion(resetVersion);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return version;
}

/** Usado desde Ajustes → "Modo de uso" → "Ver la guía de nuevo". */
export async function resetAllCoachMarks(): Promise<void> {
  const ids: CoachMarkScreenId[] = ['capture', 'certificates', 'verification'];
  await Promise.all(ids.map((id) => AsyncStorage.removeItem(KEY_PREFIX + id)));
  resetVersion++;
  listeners.forEach((listener) => listener());
}
