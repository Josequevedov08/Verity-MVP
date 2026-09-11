/**
 * notificationService.ts
 * ---------------------------------------------------------------------------
 * Notificaciones locales de Verity, centralizadas en un solo lugar.
 *
 * Antes esta lógica vivía suelta dentro de CaptureScreen.tsx, con un
 * import DINÁMICO de expo-notifications guardado detrás de un chequeo de
 * "¿estamos en Expo Go?" — porque un import estático reventaba el bundle
 * entero ahí. Desde que se decidió probar todo por APK real (nunca más
 * Expo Go), ese guard ya no hace falta: import estático normal, como
 * cualquier otro servicio de la app.
 *
 * Tres tipos de notificación:
 *   1. Permiso: se pide UNA vez, justo al terminar el onboarding (ver
 *      App.tsx) — no después del primer sello como antes, que se sentía
 *      como que "aparecía de la nada" en medio de otra tarea.
 *   2. Progreso de lote: una notificación fija que se ACTUALIZA en el
 *      mismo identificador (Android la reemplaza en el lugar, no apila
 *      una nueva cada vez) mientras se sella un lote — como una barra de
 *      descarga. Pedido explícito del usuario.
 *   3. Resumen final: se dispara una sola vez al terminar el lote.
 */
import * as Notifications from 'expo-notifications';

let handlerConfigured = false;

function configureHandler() {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

async function hasPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Pide el permiso de notificaciones. Se llama una sola vez, al terminar el
 * onboarding (antes de que el usuario llegue siquiera a Home) — nunca
 * bloquea nada si se niega, es un aviso de cortesía en toda la app.
 */
export async function requestNotificationPermission(): Promise<void> {
  configureHandler();
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch (error) {
    console.warn('No se pudo pedir el permiso de notificaciones (no es crítico):', error);
  }
}

const BATCH_PROGRESS_ID = 'verity-batch-progress';

/**
 * Notificación de progreso del lote, actualizable en el mismo
 * identificador — Android la reemplaza en el lugar en vez de apilar una
 * nueva por cada foto/video sellado.
 */
export async function notifyBatchProgress(processed: number, total: number, label: string): Promise<void> {
  configureHandler();
  try {
    if (!(await hasPermission())) return;
    await Notifications.scheduleNotificationAsync({
      identifier: BATCH_PROGRESS_ID,
      content: {
        title: `Sellando ${processed} de ${total}`,
        body: label,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.LOW,
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('No se pudo actualizar la notificación de progreso (no es crítico):', error);
  }
}

/** Se llama al terminar el lote (o si se cancela) — saca la notificación
 * de progreso de la barra, ya no tiene sentido dejarla pegada ahí. */
export async function dismissBatchProgress(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(BATCH_PROGRESS_ID);
  } catch {
    // No crítico.
  }
}

/** Notificación única al terminar el lote, con el resumen final. */
export async function notifyBatchComplete(body: string): Promise<void> {
  configureHandler();
  try {
    if (!(await hasPermission())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Verity: lote sellado', body },
      trigger: null,
    });
  } catch (error) {
    console.warn('No se pudo mostrar la notificación del lote (no es crítico):', error);
  }
}
