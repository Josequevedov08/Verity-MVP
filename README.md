# Verity — MVP para Shipaton 2026

App móvil mínima viable que sella fotos con una huella digital (SHA-256)
calculada en el dispositivo y la registra en un registro público
(Polygon Amoy, testnet) — sin subir el archivo original a ningún lado.

Construida para el hackathon [Shipaton 2026](https://www.shipaton.com/) de
RevenueCat. Ver el contexto completo del protocolo (fuera de alcance para
este MVP) en [`reference/VERITY_VRT_Documento_Maestro_v1.1.pdf`](reference/VERITY_VRT_Documento_Maestro_v1.1.pdf).

## Estructura del proyecto

```
VERITY/
├── app/                    # Código de la app móvil (Expo + TypeScript)
│   ├── screens/             # Pantallas: Sellar, Mis sellos, Verificar
│   ├── components/          # Componentes reutilizables (botones, tarjetas)
│   ├── services/             # Hash, blockchain, RevenueCat
│   ├── utils/                 # Historial local, helpers
│   └── App.tsx
├── backend/                 # Backend simple (Vercel/Supabase) — pendiente
├── verification/             # Página pública de verificación (web) — pendiente
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
   cuando tengas cuenta de RevenueCat — el freemium funciona como stub
   sin ella).
2. Fondear la wallet del dispositivo con POL de prueba la primera vez
   (gratis, vía [faucet oficial de Polygon](https://faucet.polygon.technology/),
   red "Amoy") — la dirección se puede obtener llamando a
   `getDeviceWalletAddress()` desde `app/services/blockchainService.ts`
   durante pruebas, o revisando el log de la consola tras el primer sello.

⚠️ Importante: solo se probó en **Expo Go**. Algunos módulos nativos más
nuevos (ej. `expo-media-library` con su API "Next" de SDK 57) no
funcionan dentro de Expo Go y requieren un "development build" — por eso
se evitaron deliberadamente en este MVP (ver decisión documentada en
`app/screens/CaptureScreen.tsx`).

## Qué SÍ incluye este MVP

- Captura por cámara o galería → hash SHA-256 local → registro en Polygon Amoy → certificado.
- Nivel de confianza simplificado: ALTO / MEDIO / BAJO, calculado por origen
  del archivo y presencia real de metadatos EXIF (ver
  [`documentation/technical/verity-protocol.ts`](documentation/technical/verity-protocol.ts)).
- Historial local de sellos (sin cuenta, sin servidor), con detalle
  completo dentro de la app (no hace falta salir al navegador salvo que
  el usuario lo pida explícitamente).
- Detección de duplicados: si sellas el mismo archivo dos veces, Verity
  te muestra el certificado existente en vez de anclar (y cobrar gas) de
  nuevo.
- Copia de seguridad exportable/importable del historial local (ver
  sección "Respaldo y recuperación" abajo).
- Modelo freemium con RevenueCat: 10 sellos gratis/mes, PRO $4.99/mes
  (stub funcional, sin API keys reales todavía).

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
  Alternativa de bajo costo ya evaluada: acceso directo a la cámara al
  abrir la app (sin pasar por menús) + widget/acceso directo en la
  pantalla de inicio del teléfono.

## Respaldo y recuperación (qué pasa si pierdes el teléfono)

El sello en sí (la transacción en Polygon Amoy) es permanente y no
depende del teléfono. Lo que SÍ vive solo en el dispositivo es el índice
local — miniaturas, fechas, saber qué ya sellaste — y la wallet que
identifica esos sellos como tuyos. Si desinstalas la app o pierdes el
teléfono, ese índice se pierde (no hay cuenta con la cual recuperarlo,
a propósito).

Mitigación implementada: en "Mis sellos" hay botones para **exportar**
(genera un `.json` y lo comparte por el panel nativo de Android — Drive,
correo, etc.) e **importar** una copia de seguridad de ese historial.

**Limitación importante, documentada a propósito:** el archivo de
respaldo contiene *solo* hashes, números de sello y metadatos (fecha,
ubicación si aplica) — **nunca la foto ni una miniatura**. Esto es
coherente con que Verity nunca sube el archivo original a ningún lado,
pero tiene una consecuencia real: el respaldo por sí solo no prueba que
una foto sea tuya, solo restaura tu propio registro de "qué hash sellé y
cuándo". La prueba de autoría real sigue dependiendo de que conserves el
archivo original en algún lado (tu propia nube, por ejemplo).

**Actualización:** "Verificar" ya no requiere pegar el número de sello
antes de elegir el archivo. El flujo correcto es al revés: eliges la
foto primero, Verity la hashea y busca sola en el historial local de
este dispositivo. Si la reconoce, muestra el número de sello
automáticamente. Si NO la reconoce, no significa que no esté sellada —
puede haberse sellado desde otro dispositivo, cuyo historial este
teléfono no puede ver sin un backend — en ese caso se le ofrece al
usuario escribir el número de sello a mano (si lo tiene) para
comprobarlo directamente contra el registro público.

Pendiente para una fase futura (no en este MVP, requiere backend): un
índice público mínimo (`backend/anchor.ts`, ver estructura de carpetas)
que permita verificar un archivo *sin* necesitar el número de sello a
mano incluso cuando fue sellado desde OTRO dispositivo — hoy eso solo
funciona dentro del mismo teléfono que lo selló.

## Estado y próximos pasos

- [x] Setup técnico: Expo SDK 57, hash local, anclaje en Polygon Amoy
- [x] Flujo esencial: cámara/galería → hash → blockchain → certificado
- [x] Nivel de confianza real (EXIF, no un valor de respaldo)
- [x] Detección de duplicados + copia de seguridad exportable/importable
- [x] Detalle de certificado dentro de la app (sin salir al navegador)
- [x] Abrir la app directo en la cámara (reducir fricción de uso)
- [x] Onboarding de 3 pantallas explicando por qué se sella dentro de la app
- [ ] Paywall visual de RevenueCat + trial configurado para jueces
- [ ] Página pública de verificación (`verification/[id].html`)
- [ ] Backend simple (`backend/`) para verificar por archivo sin número de sello
- [ ] Icono y screenshots (`assets/`)
- [ ] Materiales de Devpost (`documentation/shipaton-submission/`)
- [ ] Cuenta de Google Play Console y build de producción
