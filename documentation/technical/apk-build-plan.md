# Plan: primer APK instalable (sin Google Play)

Objetivo inmediato: un archivo `.apk` real, instalable directo en un
teléfono Android (sin Expo Go, sin el menú de desarrollador flotando
encima), para:

1. Grabar el video demo de Shipaton con la app "limpia" — se abre
   como cualquier app real, con su propio ícono en el launcher.
2. Probar `expo-media-library` (guardar en la galería del sistema) y,
   si da tiempo, el selector de idioma — ninguno de los dos funciona
   dentro de Expo Go.

**Esto NO requiere Google Play Console ni el pago de $25** — ese
trámite es solo para *publicar* en la tienda, un paso totalmente
aparte que se sigue dejando para el final, tal como se decidió.

## Cómo se genera (EAS Build)

Expo ofrece un servicio de compilación en la nube (**EAS Build**) que
arma el `.apk` sin necesitar Android Studio ni el SDK de Android
instalados en esta computadora — importante porque esta máquina solo
tiene Node/Expo, no herramientas nativas de Android.

Pasos (una vez, para dejar el proyecto configurado):

1. **Cuenta de Expo** (gratis, no es Google Play) — si no tienes una,
   se crea en `eas login` (abre el navegador, tú mismo inicias
   sesión o te registras — esto es algo que decides y haces tú,
   no algo que yo pueda hacer por ti).
2. `eas build:configure` — genera `eas.json` y vincula este proyecto
   a un ID de EAS (pide confirmación antes de crear nada).
3. Perfil **`preview`** en `eas.json`: genera un `.apk` normal,
   instalable directo (compartible por link o QR), sin pasar por
   Play Store — el que sirve para el video demo.
4. `eas build --platform android --profile preview` — la compilación
   corre en los servidores de Expo (10-20 min típico), y al terminar
   da un link de descarga del `.apk`.

## Costo

El plan gratis de EAS Build incluye una cuota mensual de compilaciones
(cambia de vez en cuando, pero históricamente alcanza de sobra para
las pocas veces que necesitaríamos generar un APK en esta fase). No
requiere tarjeta para ese nivel gratis.

## Qué se desbloquea con un build así (a diferencia de Expo Go)

- `expo-media-library` (guardar capturas en la galería del sistema).
- El selector de idioma — aunque, aclaración importante: técnicamente
  el selector de idioma **no depende de tener un build nativo**, es
  JavaScript puro (mismo mecanismo que ya usa `docs/index.html` con
  ES/EN). Se agrupó con la fase APK más por orden de prioridades que
  por una limitación técnica real — el trabajo grande ahí no es el
  interruptor en sí, sino traducir TODO el texto de la app (pantallas,
  alertas, y sobre todo los documentos legales largos de
  `LegalContentModal.tsx`), que es contenido, no código.
- Un ícono real en el launcher del teléfono (ya lo tenemos, se ve
  igual en Expo Go y en un build real).
- Ningún banner ni menú flotante de Expo Go encima de la app.

## Qué haría falta decidir antes de correr el build de verdad

- Confirmar que quieres crear/usar una cuenta de Expo (gratis).
- Si agregamos `expo-media-library` antes del build, hay que decidir
  el comportamiento exacto: ¿guardar automático al sellar, o un botón
  aparte "Guardar en galería" dentro del certificado? (pendiente de
  tu decisión cuando lleguemos a implementarlo).
