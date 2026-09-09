/**
 * withBackgroundActions.js
 * ---------------------------------------------------------------------------
 * Config plugin para react-native-background-actions.
 *
 * Por qué existe: Verity es "managed" (no hay carpeta android/ propia en el
 * repo, EAS Build la genera sola en cada build vía prebuild), así que no hay
 * un AndroidManifest.xml que editar a mano de forma permanente. Este plugin
 * inyecta, en cada build, los permisos y la declaración de servicio que la
 * librería necesita para de verdad mantener la app corriendo en segundo
 * plano en Android (foreground service) mientras se sella un lote —
 * pedido explícito del usuario: "quede en segundo plano" al salir de la
 * app (botón inicio, otra app, pantalla apagada), no solo al cambiar de
 * pestaña dentro de Verity.
 *
 * Referencia: INSTALL.md de react-native-background-actions.
 * https://github.com/Rapsssito/react-native-background-actions
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function ensurePermission(manifest, name) {
  manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
  const already = manifest.manifest['uses-permission'].some(
    (entry) => entry.$?.['android:name'] === name
  );
  if (!already) {
    manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

module.exports = function withBackgroundActions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // FOREGROUND_SERVICE y WAKE_LOCK: básicos, cualquier versión de Android.
    // FOREGROUND_SERVICE_DATA_SYNC: obligatorio desde Android 14 para
    // declarar QUÉ TIPO de trabajo hace el servicio (sellar = sincronizar
    // datos con la blockchain, no ubicación ni música ni cámara).
    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    ensurePermission(manifest, 'android.permission.WAKE_LOCK');
    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE_DATA_SYNC');

    const application = manifest.manifest.application[0];
    application.service = application.service || [];
    const serviceName = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
    const alreadyDeclared = application.service.some(
      (entry) => entry.$?.['android:name'] === serviceName
    );
    if (!alreadyDeclared) {
      application.service.push({
        $: {
          'android:name': serviceName,
          'android:foregroundServiceType': 'dataSync',
        },
      });
    }

    return config;
  });
};
