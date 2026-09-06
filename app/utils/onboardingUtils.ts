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
