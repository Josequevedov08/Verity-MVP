/**
 * revenuecatService.ts
 * ---------------------------------------------------------------------------
 * Integración con RevenueCat para el modelo freemium de Shipaton:
 *   - Gratis: 30 sellos por mes (ver FREEMIUM_LIMITS en verity-protocol.ts)
 *   - PRO ($4.99/mes): sellos ilimitados
 *
 * NOTA IMPORTANTE: las API keys reales de RevenueCat (una por plataforma)
 * y los identificadores de producto deben crearse en el dashboard de
 * RevenueCat y configurarse en .env (ver .env.example). Este archivo NO
 * trae claves hardcodeadas.
 *
 * Estado real (para no generar falsas expectativas): la lógica de límite
 * y entitlements SÍ está conectada y en uso (ver CaptureScreen.tsx +
 * PaywallModal.tsx). Lo que todavía NO existe es un producto de
 * suscripción real dado de alta en Google Play Console (requiere pagar
 * el registro de desarrollador, deliberadamente pospuesto a la fase de
 * publicación) — hasta entonces, `getOfferings()` no devuelve paquetes
 * reales y `presentPaywall()` lo indica con el motivo 'unavailable' en
 * vez de fallar en silencio o simular una compra que no es real.
 */
import Purchases, { CustomerInfo } from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREEMIUM_LIMITS } from '../../documentation/technical/verity-protocol';
import { countSealsThisMonth } from '../utils/cryptoUtils';

const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let initialized = false;

/** Inicializa el SDK una sola vez, al arrancar la app. */
export async function initRevenueCat(): Promise<void> {
  if (initialized || !REVENUECAT_API_KEY_ANDROID) return;
  Purchases.configure({ apiKey: REVENUECAT_API_KEY_ANDROID });
  initialized = true;
}

const DEV_PRO_OVERRIDE_KEY = 'verity_dev_pro_override';

/**
 * Además de `__DEV__` (Expo Go), el modo prueba también se permite si
 * esta variable de entorno viene en `true` — pensada EXCLUSIVAMENTE
 * para el build `preview` de EAS (ver eas.json y
 * documentation/technical/apk-build-plan.md): un .apk real, fuera de
 * Expo Go, donde igual hace falta poder simular PRO para probar/grabar
 * el demo mientras no existe un producto de suscripción real en Play
 * Console. Esta variable se configura SOLO en el entorno "preview" de
 * EAS (`eas env:set` / `eas env:push`) — nunca en "production", así
 * que el build que algún día se suba de verdad a la tienda sigue sin
 * tener forma de activar PRO gratis, igual que antes.
 */
const PREVIEW_BUILD_ALLOWS_DEV_PRO = process.env.EXPO_PUBLIC_ALLOW_DEV_PRO_OVERRIDE === 'true';

/** true solo en Expo Go (__DEV__) o en el build preview con la bandera
 * de arriba activada — nunca en un build de producción real. */
export const isDevProOverrideAllowed = __DEV__ || PREVIEW_BUILD_ALLOWS_DEV_PRO;

/**
 * SOLO PRUEBAS — ver isDevProOverrideAllowed arriba para dónde
 * funciona de verdad. Simula tener PRO activo sin pasar por una
 * compra real, para poder probar en el propio teléfono lo que ve un
 * usuario PRO (lote múltiple, etc.) mientras todavía no existe un
 * producto de suscripción real en Play Console (ver nota arriba). En
 * un build de producción esta función no hace nada — no hay forma de
 * "activar PRO gratis" en la app real. Se controla desde Ajustes →
 * sección "Modo prueba".
 */
export async function setDevProOverride(enabled: boolean): Promise<void> {
  if (!isDevProOverrideAllowed) return;
  await AsyncStorage.setItem(DEV_PRO_OVERRIDE_KEY, enabled ? '1' : '0');
}

export async function getDevProOverride(): Promise<boolean> {
  if (!isDevProOverrideAllowed) return false;
  return (await AsyncStorage.getItem(DEV_PRO_OVERRIDE_KEY)) === '1';
}

/** Consulta si el usuario tiene la suscripción PRO activa. */
export async function isProUser(): Promise<boolean> {
  if (await getDevProOverride()) return true;
  if (!initialized) return false;
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active[FREEMIUM_LIMITS.PRO_ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.warn('No se pudo consultar el estado de RevenueCat:', error);
    return false;
  }
}

export interface SealUsage {
  used: number;
  limit: number;
  isPro: boolean;
  /** true si ya llegó al límite mensual y NO es PRO. */
  limitReached: boolean;
}

/**
 * Da el estado completo de uso del plan gratis/PRO en una sola llamada
 * — se usa tanto para decidir si bloquear el sellado como para mostrar
 * "llevas X de 30 este mes" en la UI (CaptureScreen, StatsCard).
 */
export async function getSealUsage(): Promise<SealUsage> {
  const isPro = await isProUser();
  const used = await countSealsThisMonth();
  const limit = FREEMIUM_LIMITS.FREE_SEALS_PER_MONTH;
  return { used, limit, isPro, limitReached: !isPro && used >= limit };
}

/** Verifica si el usuario todavía puede sellar este mes (gratis hasta el límite, o ilimitado si es PRO). */
export async function canSealThisMonth(): Promise<boolean> {
  const usage = await getSealUsage();
  return !usage.limitReached;
}

export type PaywallOutcome =
  | { status: 'purchased' }
  | { status: 'cancelled' }
  /** No hay un producto de suscripción real configurado todavía (falta
   * Google Play Console — ver nota arriba). No es un error del usuario. */
  | { status: 'unavailable' };

/**
 * Intenta mostrar la compra de PRO. Ver PaywallOutcome — 'unavailable'
 * es el resultado ESPERADO hasta que exista un producto real en Play
 * Store, y se distingue a propósito de 'cancelled' (el usuario sí tenía
 * la opción y se arrepintió) para poder mostrar el mensaje correcto.
 */
export async function presentPaywall(): Promise<PaywallOutcome> {
  if (!initialized) return { status: 'unavailable' };

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current || !current.availablePackages.length) {
      return { status: 'unavailable' };
    }

    const { customerInfo } = await Purchases.purchasePackage(current.availablePackages[0]);
    const purchased = customerInfo.entitlements.active[FREEMIUM_LIMITS.PRO_ENTITLEMENT_ID] !== undefined;
    return { status: purchased ? 'purchased' : 'cancelled' };
  } catch (error) {
    console.warn('No se pudo completar la compra de PRO:', error);
    return { status: 'unavailable' };
  }
}

export type RestoreOutcome = { restored: boolean; error?: string };

/**
 * "Restaurar compra": sin cuenta/login, Verity identifica al usuario
 * con un ID anónimo guardado en el teléfono — si se borran los datos
 * de la app o se reinstala, ese ID se pierde y, sin esto, alguien que
 * SÍ pagó dejaría de verse como PRO (un problema real: se le estaría
 * cobrando sin reconocerle lo que pagó). Esta función le pregunta
 * directo a la tienda (Google Play) "¿esta cuenta ya compró PRO?" —
 * funciona mientras sea la MISMA cuenta de Google Play en el
 * dispositivo (igual que Spotify, Netflix, etc.; no es una limitación
 * exclusiva de no tener login propio). Se usa desde Ajustes y desde el
 * paywall.
 */
export async function restorePurchases(): Promise<RestoreOutcome> {
  if (!initialized) {
    return { restored: false, error: 'La tienda de pago no está lista todavía.' };
  }
  try {
    const info = await Purchases.restorePurchases();
    const restored = info.entitlements.active[FREEMIUM_LIMITS.PRO_ENTITLEMENT_ID] !== undefined;
    return { restored };
  } catch (error) {
    console.warn('No se pudo restaurar la compra:', error);
    return { restored: false, error: 'No se pudo consultar la tienda. Intenta de nuevo más tarde.' };
  }
}
