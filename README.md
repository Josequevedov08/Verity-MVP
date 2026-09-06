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

1. Copiar `.env.example` a `.env` y completar `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
   (ver dashboard de RevenueCat).
2. Fondear la wallet del dispositivo con MATIC de prueba la primera vez
   (gratis, vía [faucet de Polygon Amoy](https://faucet.polygon.technology/)) —
   la dirección se puede obtener llamando a `getDeviceWalletAddress()`
   desde `app/services/blockchainService.ts` durante pruebas.

## Qué SÍ incluye este MVP

- Captura por cámara o galería → hash SHA-256 local → registro en Polygon Amoy → certificado.
- Nivel de confianza simplificado: ALTO / MEDIO / BAJO (ver [`documentation/technical/verity-protocol.ts`](documentation/technical/verity-protocol.ts)).
- Historial local de sellos (sin cuenta, sin servidor).
- Modelo freemium con RevenueCat: 10 sellos gratis/mes, PRO $4.99/mes.

## Qué NO incluye (a propósito)

Detección de IA, wallet visible, multi-chain, login, y el token VRT. Ver
el prompt de proyecto en `documentation/` para el detalle de por qué.

## Estado y próximos pasos

Este commit cubre el setup técnico y el flujo esencial (cámara → hash →
blockchain → certificado). Pendiente para completar el timeline:

- [ ] Pulir UX minimalista y copy sin jerga técnica (revisión final)
- [ ] Paywall visual de RevenueCat + trial configurado para jueces
- [ ] Página pública de verificación (`verification/[id].html`)
- [ ] Backend simple (`backend/`) si se decide no depender solo de RPC público
- [ ] Icono y screenshots (`assets/`)
- [ ] Materiales de Devpost (`documentation/shipaton-submission/`)
- [ ] Cuenta de Google Play Console y build de producción
