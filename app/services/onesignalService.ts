/**
 * onesignalService.ts
 * ---------------------------------------------------------------------------
 * Notificaciones push de OneSignal. Uso principal ahora mismo: recordarle a
 * los testers de la prueba cerrada de Google Play que abran la app — Google
 * exige testers ACTIVOS a diario durante 14 días seguidos, no solo la
 * instalación inicial, así que un recordatorio simple reduce el riesgo de
 * que alguien se olvide y se caiga del conteo.
 *
 * No requiere login: OneSignal identifica cada instalación por su propio ID
 * de dispositivo, igual que ya hace Verity con la wallet (ver
 * revenuecatService.ts para el mismo patrón de "sin cuenta").
 *
 * IMPORTANTE: el push no funciona en Expo Go, hace falta un build real
 * (EAS) — igual que expo-media-library y expo-notifications en este
 * proyecto (ver README, sección "Cómo probar la app").
 */
import { OneSignal } from 'react-native-onesignal';

const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? '';

let initialized = false;

/** Inicializa el SDK una sola vez, al arrancar la app. */
export function initOneSignal(): void {
  if (initialized || !ONESIGNAL_APP_ID) return;
  OneSignal.initialize(ONESIGNAL_APP_ID);
  // Pide permiso de notificaciones push (separado del permiso de
  // notificaciones locales que ya maneja expo-notifications para el
  // sellado en segundo plano).
  OneSignal.Notifications.requestPermission(true);
  initialized = true;
}
