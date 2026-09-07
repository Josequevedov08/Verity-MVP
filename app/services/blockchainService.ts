/**
 * blockchainService.ts
 * ---------------------------------------------------------------------------
 * Registra ("ancla") un hash SHA-256 en Polygon Amoy (testnet de Polygon,
 * gas = $0 con MATIC de prueba). Esto es lo que le da a Verity su "registro
 * público": una vez anclado, cualquiera puede verificar que ESE hash
 * existía en ESE momento, sin depender de un servidor de Verity.
 *
 * Decisiones de diseño para el MVP de Shipaton (leer antes de tocar esto):
 * - Usamos una wallet "invisible": se genera UNA VEZ en el dispositivo y su
 *   clave privada se guarda en expo-secure-store (que en Android usa el
 *   Keystore del sistema y en iOS el Keychain). El usuario JAMÁS ve una
 *   dirección, una seed phrase ni un botón de "wallet". Desde su punto de
 *   vista, solo existe "sellar" y "verificar".
 * - Es testnet (Polygon Amoy), así que el gas no cuesta dinero real. La
 *   wallet necesita MATIC de prueba (se consigue gratis en un faucet) para
 *   poder pagar el gas de las transacciones. Para el MVP esto se financia
 *   una sola vez manualmente desde https://faucet.polygon.technology/
 * - NO se sube el archivo, solo el hash (32 bytes) va en el campo `data`
 *   de una transacción de valor 0 hacia la propia wallet. Es la forma más
 *   simple y barata de anclar datos en una EVM sin desplegar un contrato.
 *   (Se puede migrar a un smart contract dedicado más adelante si se
 *   necesita, pero no es necesario para el MVP.)
 */

import * as SecureStore from 'expo-secure-store';
import { ethers } from 'ethers';

const PRIVATE_KEY_STORAGE_KEY = 'verity_device_wallet_pk';

// Polygon Amoy testnet — RPC público. El endpoint oficial de Polygon
// (rpc-amoy.polygon.technology) resultó no resolver por DNS en pruebas
// reales en dispositivo (UnknownHostException en algunas redes/operadores),
// así que el valor por defecto usa publicnode.com, un proveedor de RPC
// públicos gratuito y confiable. Se puede sobreescribir con
// EXPO_PUBLIC_AMOY_RPC_URL en .env (ver .env.example) si se prefiere un
// proveedor con cuota propia (Alchemy/Infura free tier).
const AMOY_RPC_URL =
  process.env.EXPO_PUBLIC_AMOY_RPC_URL ?? 'https://polygon-amoy-bor-rpc.publicnode.com';
const AMOY_CHAIN_ID = 80002;

export interface AnchorResult {
  /** Hash de la transacción en Polygon Amoy (sirve como "número de sello"). */
  txHash: string;
  /** Dirección de la wallet del dispositivo que firmó el registro. */
  walletAddress: string;
  /** Momento en que se envió la transacción. */
  anchoredAt: string;
  /** Link directo al explorador público para que cualquiera lo verifique. */
  explorerUrl: string;
}

/**
 * Obtiene (o crea, si es la primera vez) la wallet del dispositivo.
 * La clave privada nunca se muestra en la UI ni sale del SecureStore.
 */
async function getOrCreateDeviceWallet(): Promise<ethers.Wallet> {
  const existingKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);

  if (existingKey) {
    return new ethers.Wallet(existingKey);
  }

  // Primera vez que se usa la app en este dispositivo: generamos una
  // wallet nueva y la guardamos cifrada en el almacenamiento seguro
  // del sistema operativo (Android Keystore / iOS Keychain).
  // ethers.Wallet.createRandom() devuelve un HDNodeWallet (tipo distinto a
  // Wallet); lo normalizamos reconstruyendo un Wallet simple a partir de su
  // clave privada, igual que hacemos al leer una clave ya existente.
  const randomWallet = ethers.Wallet.createRandom();
  await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, randomWallet.privateKey, {
    // requireAuthentication: false porque el usuario no debe ver ningún
    // prompt de "wallet" — el sello debe sentirse instantáneo.
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return new ethers.Wallet(randomWallet.privateKey);
}

/** Devuelve la dirección pública de la wallet del dispositivo (solo lectura). */
export async function getDeviceWalletAddress(): Promise<string> {
  const wallet = await getOrCreateDeviceWallet();
  return wallet.address;
}

/**
 * Devuelve la clave privada de la wallet del dispositivo, para poder
 * respaldarla (ver SettingsModal.tsx: "Respaldar mi wallet"). Sin esto,
 * si el usuario borra los datos de la app o cambia de teléfono, pierde
 * para siempre la capacidad de sellar con la misma identidad — no hay
 * forma de recuperarla, ni siquiera reinstalando. Quien la use decide
 * cómo guardarla a salvo (es tan sensible como una contraseña: quien la
 * tenga puede firmar transacciones como si fuera este dispositivo).
 */
export async function exportDeviceWalletPrivateKey(): Promise<string> {
  const wallet = await getOrCreateDeviceWallet();
  return wallet.privateKey;
}

/**
 * Restaura la wallet del dispositivo a partir de una clave privada
 * respaldada antes (ver exportDeviceWalletPrivateKey). Sobrescribe la
 * wallet actual — se usa cuando el usuario perdió su historial local
 * (ej. cambió de teléfono) y quiere recuperar la MISMA identidad con la
 * que selló antes, para que sus certificados viejos sigan mostrando
 * "sellado por" la wallet correcta.
 *
 * Lanza un error con mensaje claro si la clave no tiene forma válida —
 * mejor eso que guardar algo corrupto en SecureStore sin darse cuenta.
 */
export async function restoreDeviceWalletFromPrivateKey(privateKey: string): Promise<string> {
  const trimmed = privateKey.trim();
  let wallet: ethers.Wallet;
  try {
    wallet = new ethers.Wallet(trimmed);
  } catch {
    throw new Error('Esa clave no tiene un formato válido. Revisa que la copiaste completa.');
  }

  await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, trimmed, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return wallet.address;
}

/**
 * Ancla un hash SHA-256 en Polygon Amoy.
 *
 * @param sha256Hash Hash en hexadecimal (con o sin prefijo "0x").
 */
export async function anchorHashOnChain(sha256Hash: string): Promise<AnchorResult> {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL, AMOY_CHAIN_ID);
  const wallet = (await getOrCreateDeviceWallet()).connect(provider);

  const hashBytes = sha256Hash.startsWith('0x') ? sha256Hash : `0x${sha256Hash}`;

  // Transacción de valor 0 hacia la propia wallet, con el hash en `data`.
  // Es la forma más económica de dejar un dato inmutable en la cadena
  // sin necesidad de desplegar (ni mantener) un smart contract propio.
  const tx = await wallet.sendTransaction({
    to: wallet.address,
    value: 0n,
    data: hashBytes,
  });

  await tx.wait(1);

  return {
    txHash: tx.hash,
    walletAddress: wallet.address,
    anchoredAt: new Date().toISOString(),
    explorerUrl: `https://amoy.polygonscan.com/tx/${tx.hash}`,
  };
}

/**
 * Verifica si un hash fue anclado por una transacción específica, leyendo
 * directamente de la blockchain (no depende de ninguna base de datos de
 * Verity). Se usa en la pantalla "Verificar".
 */
export async function verifyAnchor(
  txHash: string,
  expectedSha256: string
): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL, AMOY_CHAIN_ID);
  const tx = await provider.getTransaction(txHash);

  if (!tx || !tx.data) return false;

  const expected = expectedSha256.startsWith('0x')
    ? expectedSha256.toLowerCase()
    : `0x${expectedSha256.toLowerCase()}`;

  return tx.data.toLowerCase() === expected;
}

export interface AnchorLookupResult {
  /** true si existe una transacción con ese hash y tiene forma de sello de Verity. */
  exists: boolean;
  /** La huella digital (SHA-256) que quedó anclada en esa transacción, si existe. */
  sha256?: string;
  explorerUrl?: string;
}

/**
 * Busca un número de sello (hash de transacción) directamente en la
 * blockchain, SIN necesitar un archivo para comparar. Responde solo
 * "¿este sello existe?" — se usa cuando el usuario escribe un número de
 * sello a mano y quiere confirmar que es real, sin tener (o sin querer
 * elegir todavía) el archivo correspondiente.
 */
export async function lookupAnchorByTxHash(txHash: string): Promise<AnchorLookupResult> {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL, AMOY_CHAIN_ID);
  const cleanTxHash = txHash.trim();

  try {
    const tx = await provider.getTransaction(cleanTxHash);

    // Un sello de Verity siempre tiene 32 bytes de datos (un SHA-256) y
    // ningún valor transferido. Si la transacción existe pero no tiene
    // esa forma, no es (o no parece) un sello válido.
    if (!tx || !tx.data || tx.data === '0x') {
      return { exists: false };
    }

    return {
      exists: true,
      sha256: tx.data,
      explorerUrl: `https://amoy.polygonscan.com/tx/${cleanTxHash}`,
    };
  } catch (error) {
    console.warn('Error buscando el número de sello en la blockchain:', error);
    return { exists: false };
  }
}
