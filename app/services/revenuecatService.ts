/**
 * revenuecatService.ts
 * ---------------------------------------------------------------------------
 * Integración con RevenueCat para el modelo freemium de Shipaton:
 *   - Gratis: 10 sellos por mes (ver FREEMIUM_LIMITS en verity-protocol.ts)
 *   - PRO ($4.99/mes): sellos ilimitados
 *
 * NOTA IMPORTANTE: las API keys reales de RevenueCat (una por plataforma)
 * y los identificadores de producto deben crearse en el dashboard de
 * RevenueCat y configurarse en .env (ver .env.example). Este archivo NO
 * trae claves hardcodeadas.
 *
 * Estado: stub funcional. La lógica de compra/entitlements está lista para
 * conectarse en cuanto existan las API keys — ver TODOs.
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

/**
 * Verifica si el usuario todavía puede sellar este mes (gratis hasta el
 * límite, o ilimitado si es PRO).
 */
export async function canSealThisMonth(): Promise<boolean> {
  if (await isProUser()) return true;
  const used = await countSealsThisMonth();
  return used < FREEMIUM_LIMITS.FREE_SEALS_PER_MONTH;
}

/** Muestra el paywall nativo de RevenueCat para pasar a PRO. */
export async function presentPaywall(): Promise<boolean> {
  // TODO: reemplazar por react-native-purchases-ui cuando se configure
  // el paywall visual en el dashboard de RevenueCat.
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current || !current.availablePackages.length) return false;

  try {
    const { customerInfo } = await Purchases.purchasePackage(current.availablePackages[0]);
    return customerInfo.entitlements.active[FREEMIUM_LIMITS.PRO_ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.warn('Compra cancelada o fallida:', error);
    return false;
  }
}
