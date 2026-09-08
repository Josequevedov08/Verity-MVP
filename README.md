# Verity — MVP para Shipaton 2026

App móvil que sella **fotos y videos** con una huella digital (SHA-256)
calculada en el dispositivo y la registra en un registro público
(Polygon Amoy, testnet) — sin subir el archivo original a ningún lado.

Construida para el hackathon [Shipaton 2026](https://www.shipaton.com/) de
RevenueCat. Ver el contexto completo del protocolo (fuera de alcance para
este MVP) en [`reference/VERITY_VRT_Documento_Maestro_v1.1.pdf`](reference/VERITY_VRT_Documento_Maestro_v1.1.pdf).

**Versión actual: 0.3.7.** Ver "Versionado" más abajo para el esquema
que se sigue de acá en adelante.

## Estructura del proyecto

```
VERITY/
├── app/                    # Código de la app móvil (Expo + TypeScript)
│   ├── screens/             # Pantallas: Sellar, Mis sellos, Verificar, Onboarding
│   ├── components/          # Componentes reutilizables (tarjetas, modales, sello, paywall...)
│   ├── services/             # Hash, blockchain, RevenueCat, índice público
│   ├── utils/                 # Historial local, respaldo, recorrido guiado
│   └── App.tsx
├── backend/                 # Índice público (Supabase) — ver backend/README.md
├── docs/                      # Página pública de verificación (GitHub Pages)
├── assets/                    # Icono y screenshots para Google Play
├── documentation/
│   ├── technical/verity-protocol.ts   # Definición técnica del MVP
│   └── shipaton-submission/            # Materiales para Devpost
└── reference/                # Documento maestro y web informativa (NO se implementan tal cual)
```

## Cómo probar la app

```bash
npm install
npm start
```

Esto abre Expo Dev Tools; escanea el QR con la app **Expo Go** en tu
teléfono Android, o presiona `a` para abrir un emulador Android.

Antes de sellar de verdad necesitas:

1. Copiar `.env.example` a `.env` (el RPC de Polygon Amoy por defecto ya
   funciona sin más cambios; solo completa `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
   cuando tengas cuenta de RevenueCat — ver "Freemium y pagos" abajo).
2. Fondear la wallet del dispositivo con POL de prueba la primera vez
   (gratis, vía [faucet oficial de Polygon](https://faucet.polygon.technology/),
   red "Amoy") — la dirección se ve en Ajustes → "Wallet del dispositivo".

⚠️ Importante: solo se probó en **Expo Go**. Algunos módulos nativos más
nuevos (ej. `expo-media-library` para guardar en la galería del sistema)
no funcionan dentro de Expo Go y requieren un "development build" — por
eso se evitaron deliberadamente en este MVP (ver decisión documentada en
`app/screens/CaptureScreen.tsx`).

## Qué SÍ incluye este MVP

- **Sella fotos Y videos**: cámara (foto o video, cada uno en su propio
  modo para evitar el gesto ambiguo de "mantener presionado" que falla
  en algunas cámaras nativas) o galería → hash SHA-256 local → registro
  en Polygon Amoy → certificado. Para video se extrae además un frame
  real como vista previa (`expo-video-thumbnails`) y se puede reproducir
  de verdad (controles nativos) tocando la carta del certificado.
- Nivel de confianza simplificado: ALTO / MEDIO / BAJO, calculado por
  origen del archivo y metadatos disponibles (ver
  [`documentation/technical/verity-protocol.ts`](documentation/technical/verity-protocol.ts)) —
  con una aclaración explícita en la propia app de que esto NO evalúa si
  el contenido es real o falso, solo cuánta evidencia de origen hay.
- Historial local de sellos (sin cuenta, sin servidor): lista o grilla,
  con una tarjeta de estadísticas (total + desglose por confianza), y
  detalle completo dentro de la app — incluye deslizar entre
  certificados y voltear la carta (animación de "giro de moneda") para
  ver la foto/video real o, si no hay archivo local, un sello
  (`SealMedallion`) que confirma que el certificado sigue siendo válido.
- Número de sello con secuencia real (`#A00001`, `#A00002`...): el
  orden en que se selló cada archivo en ese teléfono — no un dato
  decorativo, sirve para nombrar/ordenar archivos propios.
- Detección de duplicados: si sellas el mismo archivo dos veces, Verity
  te muestra el certificado existente en vez de anclar (y cobrar gas) de
  nuevo.
- Copia de seguridad exportable/importable del historial local, y
  **respaldo/restauración de la wallet del dispositivo** (ver sección
  "Respaldo y recuperación" abajo — sin esto, borrar los datos de la
  app pierde la identidad con la que se selló para siempre).
- **Sellado en lote (solo PRO)**: elegir varias fotos/videos de golpe
  en Galería — se sellan uno por uno en segundo plano (nunca en
  paralelo, para no chocar el nonce de la wallet) con una barra de
  progreso general, y un resumen al final (cuántos se sellaron,
  cuántos ya estaban repetidos). El plan gratis sigue siendo uno a la
  vez, como siempre.
- Freemium con RevenueCat conectado de verdad (ver "Freemium y pagos").
- Splash screen animado, onboarding de 4 pantallas (incluye el plan
  gratis/PRO), y un recorrido guiado (coach marks) que resalta los
  controles principales de cada pestaña la primera vez que se visita.
- Diseño con una sola identidad visual (ver `app/theme/`): modo Claro,
  Oscuro y Sistema, seleccionable desde Ajustes en cualquiera de las 3
  pantallas. Sección legal real en Ajustes: Política de privacidad,
  Términos de uso, FAQ y "Modo de uso" — no texto de relleno genérico.
- **Ícono real de la app**: monograma "VRT" simple (blanco sobre el
  negro base del modo oscuro, `#0B0B0F`) — el mismo logo que usa la
  página pública de verificación, para que la marca sea consistente
  en todos lados. Incluye ícono adaptativo de Android
  (`adaptive-icon-foreground.png`) para que se vea bien recortado en
  círculo, cuadrado redondeado, etc. según el launcher del teléfono.
- **Índice público de verificación** (`backend/`, Supabase): "Verificar"
  ahora encuentra un archivo sellado desde OTRO dispositivo por su
  huella digital, sin necesitar el número de sello a mano — más una
  página web (`docs/index.html`) para verificar sin instalar la app.
  Ver "Backend e índice público" más abajo.

## Freemium y pagos

- Gratis: 30 sellos/mes. PRO: $4.99/mes, ilimitado.
- El límite y el paywall (`PaywallModal.tsx`) están conectados de
  verdad — antes de sellar se revisa el uso del mes, y al llegar al
  límite se bloquea con el paywall en vez de dejar sellar gratis sin
  tope.
- **Lo que falta para cobrar de verdad**: un producto de suscripción
  real dado de alta en Google Play Console (requiere el registro de
  desarrollador, $25 pago único — deliberadamente pospuesto a la fase
  de publicación). Hasta entonces, tocar "Suscribirme" avisa
  honestamente que no está disponible todavía, en vez de fallar en
  silencio o simular una compra.
- **Restaurar compra**: como Verity no pide cuenta, la suscripción se
  identifica con un ID vinculado a la cuenta de Google Play del
  dispositivo — si se borran los datos de la app o se reinstala, ese ID
  se pierde. El botón "Restaurar compra" (Ajustes y en el paywall) le
  pregunta directo a Google Play si esa cuenta ya pagó, y reactiva el
  PRO — funciona mientras sea la misma cuenta de Google Play, igual que
  en Spotify/Netflix/etc. Documentado en Términos de uso y FAQ dentro
  de la app.

## Qué NO incluye (a propósito)

Detección de IA, wallet visible, multi-chain, login, y el token VRT. Ver
el prompt de proyecto en `documentation/` para el detalle de por qué.
También se evaluó y se descartó por ahora:

- **Sellado automático desde la cámara nativa del sistema** (sin abrir
  Verity): técnicamente posible con un servicio en segundo plano
  vigilando la galería, pero requeriría salir de Expo Go (development
  build) y — más importante — debilitaría la garantía de nivel ALTO,
  porque ya no habría certeza de que el archivo no fue editado entre el
  momento de la captura real y el momento en que Verity lo detecta.
- **Guardar automáticamente en la galería del sistema**
  (`expo-media-library`): requiere development build, no funciona en
  Expo Go — pospuesto a la fase de armar el APK.

## Respaldo y recuperación (qué pasa si pierdes el teléfono)

El sello en sí (la transacción en Polygon Amoy) es permanente y no
depende del teléfono. Lo que SÍ vive solo en el dispositivo es el índice
local (miniaturas, fechas, saber qué ya sellaste) y la wallet que
identifica esos sellos como tuyos.

Mitigaciones implementadas, ambas en "Mis sellos" / Ajustes:

- **Historial**: exportar/importar un `.json` con hashes, números de
  sello y metadatos (nunca la foto ni una miniatura — Verity no sube ni
  guarda el archivo original en ningún respaldo, a propósito). El
  respaldo por sí solo no prueba autoría de una foto, solo restaura tu
  propio índice de "qué sellé y cuándo".
- **Wallet**: "Respaldar mi wallet" (Ajustes) exporta la clave privada
  del dispositivo a un archivo — tan sensible como una contraseña, con
  advertencia explícita — y "Restaurar desde respaldo" la reinstala en
  un teléfono nuevo. Sin esto, borrar los datos de la app pierde para
  siempre la identidad con la que se selló (le pasó a un usuario real
  en pruebas).

"Verificar" no requiere pegar el número de sello antes de elegir el
archivo: el flujo es al revés — eliges la foto/video primero, Verity la
hashea y busca sola, primero en el historial local de este dispositivo
y, si no está ahí, en el **índice público** (ver "Backend e índice
público" abajo) por si se selló desde OTRO dispositivo. Solo si tampoco
aparece ahí hace falta escribir el número de sello a mano.

## ⚠️ Corrección importante: el hash SHA-256 (v0.3.6)

Hasta la v0.3.5, `hashService.ts` calculaba el hash sobre el **texto
base64** del archivo (`Crypto.digestStringAsync` opera sobre strings),
no sobre sus bytes reales — un bug real, no una decisión de diseño.
El valor resultante era consistente *dentro* de Verity (por eso
duplicados y "por número de sello" seguían funcionando), pero **no
era un SHA-256 estándar del archivo**: ninguna herramienta externa
(la página pública de verificación, `sha256sum`, etc.) podía
reconocerlo, sin importar qué copia exacta del archivo se usara.

Corregido en 0.3.6: ahora se leen los bytes crudos
(`file.arrayBuffer()`) y se hashean con `Crypto.digest()` (la API de
expo-crypto que opera sobre bytes, equivalente a
`crypto.subtle.digest()` del navegador) — el mismo resultado que
cualquier herramienta estándar calcularía. **Cualquier certificado
sellado antes de la 0.3.6 no se puede verificar "por archivo"** (ni
en la web ni por ninguna herramienta externa) porque su hash nunca
fue el hash real del archivo — sigue siendo válido dentro de la app
(historial local, número de sello), pero no cruza esa frontera. Los
certificados sellados desde la 0.3.6 en adelante sí son 100%
verificables externamente.

## Backend e índice público

`backend/` (Supabase, proyecto `verity-mvp`) guarda un índice público
**de solo metadatos** — hash, número de sello, tx de anclaje, nivel de
confianza, tipo de medio — nunca el archivo original. Existe para UNA
sola cosa: que "Verificar" encuentre un archivo sellado desde OTRO
dispositivo por su huella digital, sin necesitar el número de sello a
mano. Si este índice desapareciera, ningún sello dejaría de ser válido
— la verdad sigue viviendo en Polygon; esto solo hace más fácil
encontrarla. Ver [`backend/README.md`](backend/README.md) para el
detalle completo (por qué la escritura pasa por una Edge Function que
verifica el anclaje real en la cadena antes de aceptar nada, en vez de
un insert directo).

También existe [`docs/index.html`](docs/index.html): una página
pública de verificación sin instalar la app, publicada en
[josequevedov08.github.io/Verity-MVP](https://josequevedov08.github.io/Verity-MVP/)
vía GitHub Pages — calcula la huella digital en el propio navegador y
consulta lo mismo que la app. Bilingüe (ES/EN, detecta el idioma del
navegador) y con modo claro/oscuro real (el sello flotante se invierte
solo según el tema), más un aviso de privacidad explicando qué hace y
qué no hace la página (no usa cookies ni analítica).

## Versionado

- **0.2.x** (parche): arreglos y ajustes chicos dentro de la fase
  actual (prepararnos para Shipaton). Se sube con cada tanda de
  cambios.
- **0.3.0** (próxima fase): cuando se cierre esta fase y se pase a la
  siguiente (ej. sellado en lote, más pulido).
- **1.0.0**: primer lanzamiento real en Google Play Store.

## Estado y próximos pasos

- [x] Setup técnico: Expo SDK 57, hash local, anclaje en Polygon Amoy
- [x] Flujo esencial: cámara/galería (foto y video) → hash → blockchain → certificado
- [x] Nivel de confianza real, con aclaración de qué NO significa
- [x] Detección de duplicados + copia de seguridad exportable/importable
- [x] Respaldo/restauración de la wallet del dispositivo
- [x] Detalle de certificado dentro de la app, con reproducción real de video
- [x] Onboarding de 4 pantallas + recorrido guiado por pestaña
- [x] Freemium con RevenueCat conectado (límite real + paywall + restaurar compra)
- [x] Sellar varias fotos/videos a la vez (selección múltiple, solo PRO)
- [x] Índice público (`backend/`, Supabase) + página web de verificación (`docs/index.html`)
- [ ] Producto de suscripción real en Google Play Console (requiere pagar el registro)
- [ ] Guardar capturas en la galería del sistema (requiere development build)
- [ ] Selector de idioma (multi-idioma) — pospuesto a la fase del APK
- [x] Ícono de la app (real, con la identidad del sello — ver abajo)
- [ ] Screenshots para la ficha de Play Store/Devpost (`assets/`)
- [ ] Materiales de Devpost (`documentation/shipaton-submission/`)
- [ ] Registro en Shipaton, guion y grabación del video demo
- [ ] Cuenta de Google Play Console y build de producción (v1.0.0)
