/**
 * onboardingUtils.ts
 * ---------------------------------------------------------------------------
 * Controla si ya se le mostró al usuario el onboarding de 3 pantallas
 * (por qué Verity necesita tomar la foto dentro de la app). Se guarda en
 * AsyncStorage, no en ningún servidor — se muestra una sola vez por
 * instalación.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_SEEN_KEY = 'verity_onboarding_seen';

export async function hasSeenOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
  return value === 'true';
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}

/**
 * Borra la marca de "ya visto" — solo para el botón de pruebas en Ajustes
 * (ver isDevProOverrideAllowed en SettingsModal.tsx), así se puede volver
 * a ver el onboarding/splash cuantas veces haga falta sin desinstalar la
 * app ni borrar todo el almacenamiento de Expo Go.
 */
export async function resetOnboardingSeen(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_SEEN_KEY);
}
