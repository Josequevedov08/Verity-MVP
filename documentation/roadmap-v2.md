# Verity V2.0: mapa de ruta e integraciones técnicas post-Shipaton

Este documento consolida la arquitectura técnica y las implementaciones
proyectadas para escalar Verity más allá del MVP actual, resolviendo la
degradación de metadatos en redes sociales y eliminando la fricción
económica de la infraestructura Web3.

Nada de lo que sigue es necesario para el envío a Shipaton (30 de
septiembre): es el plan para después. Para la prueba cerrada actual
seguimos exactamente como estamos hoy. Ver el resumen corto en el
`README.md`, sección "Hoja de ruta V2.0".

**Orden de prioridad** (por qué este orden, no el orden en que se nos
ocurrieron las ideas): se ataca primero el dolor que YA vivimos de
verdad (la wallet del funder vaciándose), después el diferenciador de
producto más fuerte (sobrevivir a la compresión de redes sociales), y
se deja para el final lo que es infraestructura pesada sin un problema
real que lo justifique todavía (operar una red propia).

## 1. Arquitectura cero-gas (account abstraction)

El usuario final no interactuará con conceptos de Web3, tokens
nativos, ni necesitará recargar saldo (POL) para operar. La aplicación
funcionará bajo una experiencia Web2 tradicional.

- **Firmas digitales (ERC-4337)**: la wallet generada y protegida en
  el keystore/keychain del dispositivo dejará de enviar transacciones
  directas a la blockchain. Su función exclusiva será firmar
  criptográficamente la intención de registro.
- **Integración de paymasters/relayers**: se implementará un servicio
  de retransmisión (como Biconomy, Gelato Network o Thirdweb) en el
  backend (Supabase/Node.js).
- **Subsidio de transacciones**: el backend recibirá la firma del
  usuario y despachará la transacción a la red Amoy (o la red
  definitiva), pagando el gas de forma centralizada.
- **Sinergia de monetización**: el costo operativo del gas pagado por
  el backend será cubierto por la suscripción de RevenueCat
  ($4.99/mes), justificando financieramente el modelo "gasless" para
  los usuarios de Verity PRO.

**Ojo con esto antes de construirlo**: el paymaster no elimina el
costo del gas, solo lo mueve del "funder que se vacía" a un "relayer
que se recarga". Sigue siendo dinero real que alguien paga por cada
sello, y los usuarios FREE (que no pagan RevenueCat) seguirían
generando ese costo sin un ingreso que lo cubra, igual que hoy. Este
punto mejora la experiencia (nadie más tiene que estar pendiente de
un funder), pero no resuelve solo el problema económico de fondo:
sigue haciendo falta que el volumen de usuarios PRO cubra el gas de
todos.

## 2. Sistema de trazabilidad visual resiliente (registro dual)

Para solucionar la pérdida del sello criptográfico cuando una imagen es
comprimida por plataformas como WhatsApp, el sistema de validación
pasará de un modelo estricto a uno compuesto.

- **Generación simultánea de hashes**: al capturar o seleccionar un
  archivo, el dispositivo calculará dos huellas digitales antes de
  enviar la transacción:
  - **SHA-256 (huella estricta)**: el sello criptográfico exacto de
    los bytes crudos (RAW/JPEG). Funciona como el documento maestro
    notariado para uso legal pericial.
  - **pHash / aHash (huella perceptiva)**: un algoritmo que evalúa la
    estructura, formas y contrastes visuales de la imagen, generando
    un código que sobrevive a cambios de resolución, filtros ligeros
    y compresión.
- **Actualización del smart contract**: el contrato inteligente se
  actualizará para recibir y emparejar ambas variables bajo el mismo
  bloque temporal: `(bytes32 sha256_hash, uint64 phash, address autor,
  uint256 timestamp)`.

## 3. Motor de validación tolerante (distancia de Hamming)

La pestaña "Verificar" y la web pública evolucionarán para reconocer
copias degradadas y conectarlas con su autor original.

- **Evaluación de similitud**: cuando un usuario suba una imagen
  descargada de redes sociales, el sistema calculará su `pHash` actual
  y lo comparará contra la base de datos pública usando el algoritmo
  de distancia de Hamming.
- **Anclaje al sello original**: si el algoritmo detecta una
  coincidencia superior al 90-95%, el sistema identificará la imagen
  como una "copia comprimida".
- **Respuesta de interfaz (UI)**: en lugar de devolver un error de
  "hash no encontrado", la alerta indicará: "Versión modificada
  detectada. Coincide visualmente en un 96% con el registro maestro
  [número de sello] creado el [fecha]. Enlazado al SHA-256 original."

**Ojo con esto antes de construirlo**: pHash con distancia de Hamming
puede dar falsos positivos con fotos DISTINTAS pero visualmente
parecidas (mismo fondo, misma pose, misma escena). Antes de prometerle
al usuario un porcentaje exacto de coincidencia en la UI, hay que
probarlo con fotos reales de testers (no solo en teoría) y definir un
umbral que funcione en la práctica, no solo en el papel.

## 4. Experiencia de usuario "caballo de Troya" (UX invisible)

Toda la complejidad técnica se ocultará detrás de una interfaz
familiar y rápida, enfocada en la retención del usuario masivo.

- **Procesamiento en segundo plano optimizado**: consolidación de la
  librería `react-native-background-actions` para asegurar que el
  cálculo simultáneo de SHA-256 y pHash en lotes grandes no bloquee el
  hilo principal (UI) ni se congele al apagar la pantalla.
- **Lenguaje de producto**: sustitución definitiva de términos como
  "blockchain", "gas", "wallet" o "hash" en las pantallas principales
  por "sello digital", "registro público" y "certificado de origen",
  manteniendo la terminología técnica en GitHub y en la sección legal
  para peritos o desarrolladores.

Este punto es más pulido continuo que una fase separada: se puede ir
aplicando en paralelo a los puntos 1-3 a medida que se tocan esas
pantallas, no hace falta esperar a terminarlos todos primero.

## 5. Transición a red propia (AppChain / token VRT) — visión a largo plazo, no plan cercano

Para garantizar la escalabilidad masiva y reducir a cero los costos
operativos a largo plazo, Verity migraría de una red de pruebas (Amoy)
a una infraestructura soberana.

- **Despliegue de subred**: creación de una red propia (por ejemplo
  Polygon Edge o Avalanche Subnet) dedicada exclusivamente a los
  contratos de Verity.
- **Economía de token propio**: al controlar los nodos validadores, el
  costo de gas por registrar certificados sería virtualmente
  inexistente, permitiendo un rendimiento de miles de transacciones
  por segundo (TPS) sin depender de las fluctuaciones de precios de
  redes públicas.

**Por qué va de último y no antes**: operar una red propia significa
ser el validador, con toda la responsabilidad que eso implica
(seguridad, nodos corriendo 24/7, mantenimiento, y que si algo falla,
nadie más certifica nada). Es meses de trabajo de infraestructura para
resolver un costo de gas que hoy, con el volumen real de Verity
(decenas de sellos), no es el problema urgente. Tiene sentido el día
que haya un volumen de usuarios que lo justifique económicamente, no
antes. Se deja documentado acá como visión, no como algo a construir
en los próximos meses.
