/**
 * backgroundSealingService.ts
 * ---------------------------------------------------------------------------
 * Mantiene a Verity con vida de verdad mientras sella un lote, aunque el
 * usuario salga de la app del todo (botón inicio, abra otra app, apague la
 * pantalla) — no solo mientras cambia de pestaña DENTRO de Verity, que ya
 * funcionaba antes. Pedido explícito del usuario tras encontrar que un
 * lote se cortaba si salía de la app: "no puedo salirme de la app porque
 * luego no sella, y eso es grave".
 *
 * Por qué hace falta esto y no alcanza con el código de siempre: Android
 * congela la ejecución de JavaScript de cualquier app en cuanto deja de
 * estar en primer plano, salvo que tenga un "foreground service" activo
 * (un servicio nativo con notificación persistente — el mismo mecanismo
 * que usa Spotify para seguir sonando o Google Maps para seguir navegando
 * con la pantalla apagada). Sin esto, el bucle de sellado de
 * CaptureScreen.tsx (processBatch) simplemente se detiene a mitad de
 * camino en cuanto Android suspende la app.
 *
 * Cómo se usa: el propio bucle de sellado (processBatch) NO se mueve
 * acá — sigue viviendo en CaptureScreen.tsx, tal cual, porque necesita
 * actualizar el estado de React de esa pantalla. Lo único que hace este
 * servicio es abrir un foreground service "vacío" (una tarea que solo
 * espera a que se le avise que terminó) apenas arranca un lote, y
 * cerrarlo cuando termina — mientras ese servicio esté activo, Android no
 * suspende el proceso, así que el bucle real sigue corriendo aunque el
 * usuario haya salido de la app.
 *
 * Ver plugins/withBackgroundActions.js para los permisos/declaración de
 * servicio que esto necesita en el AndroidManifest (inyectados en cada
 * build de EAS, ya que el proyecto es "managed" y no tiene carpeta
 * android/ propia en el repo).
 */
import BackgroundService from 'react-native-background-actions';

let stopSignal: (() => void) | null = null;

/** La "tarea" en sí no hace ningún trabajo — solo se queda esperando a
 * que stopBackgroundSealing() la libere. El trabajo real (sellar cada
 * archivo) sigue corriendo en el hilo normal de la app; esto solo evita
 * que Android lo congele mientras tanto. */
async function keepAliveTask(): Promise<void> {
  await new Promise<void>((resolve) => {
    stopSignal = resolve;
  });
}

const START_OPTIONS = {
  taskName: 'VerityLote',
  taskTitle: 'Verity está sellando tu lote',
  taskDesc: 'Preparando...',
  // Reutiliza el mismo ícono "VRT" de las notificaciones normales (ver
  // assets/icons/notification-icon.png) — el plugin de expo-notifications
  // ya lo registra en Android como drawable/notification_icon en cada
  // build, así que no hace falta duplicar el asset acá.
  taskIcon: { name: 'notification_icon', type: 'drawable' },
  color: '#4C9AFF',
  parameters: {},
  // CAUSA REAL del crash de la v0.3.45 (encontrado sin acceso al
  // teléfono, leyendo el código fuente de la librería y sus issues de
  // GitHub, no adivinando): esto faltaba. plugins/withBackgroundActions.js
  // declara `android:foregroundServiceType="dataSync"` en el
  // AndroidManifest, pero la librería TAMBIÉN necesita que se le diga el
  // tipo acá, al arrancar — si el manifest y el arranque no coinciden,
  // Android 14+ tira una excepción nativa (MissingForegroundServiceTypeException)
  // que no se puede atrapar con try/catch de JavaScript, y crashea la
  // app entera. Sin este campo, la librería arrancaba sin ningún tipo,
  // que nunca coincide con lo declarado en el manifest.
  foregroundServiceType: ['dataSync' as const],
};

/**
 * Arranca el foreground service, si no está corriendo ya (agregar más
 * archivos a un lote que ya está sellando no debe abrir un segundo
 * servicio). Nunca bloquea el sellado si falla por cualquier motivo —
 * en el peor caso, el lote sigue funcionando igual que antes (se corta
 * si el usuario sale de la app), simplemente sin esta mejora.
 */
export async function startBackgroundSealing(): Promise<void> {
  try {
    if (BackgroundService.isRunning()) return;
    await BackgroundService.start(keepAliveTask, START_OPTIONS);
  } catch (error) {
    console.warn('No se pudo activar el sellado en segundo plano (no es crítico, seguirá igual en primer plano):', error);
  }
}

/** Actualiza el texto de la notificación persistente con el progreso
 * actual ("Sellando foto 4 de 12..."), igual que una barra de descarga. */
export async function updateBackgroundSealingProgress(text: string): Promise<void> {
  try {
    if (!BackgroundService.isRunning()) return;
    await BackgroundService.updateNotification({ taskDesc: text });
  } catch {
    // No crítico.
  }
}

/** Cierra el foreground service al terminar el lote (o si se cancela a
 * mitad de camino) — no tiene sentido dejarlo corriendo sin trabajo. */
export async function stopBackgroundSealing(): Promise<void> {
  if (stopSignal) {
    stopSignal();
    stopSignal = null;
  }
  try {
    if (BackgroundService.isRunning()) await BackgroundService.stop();
  } catch {
    // No crítico.
  }
}
