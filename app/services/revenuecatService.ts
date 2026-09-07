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

/** Consulta si el usuario tiene la suscripción PRO activa. */
export async function isProUser(): Promise<boolean> {
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
