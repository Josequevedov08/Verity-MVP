// Polyfill de números aleatorios seguros para React Native: `ethers` los
// necesita para generar la wallet del dispositivo (Wallet.createRandom()),
// y React Native no trae `crypto.getRandomValues` de forma nativa. DEBE
// importarse antes que cualquier otro módulo que use `ethers` (por eso va
// como la primera línea del archivo, antes incluso del export de abajo).
import 'react-native-get-random-values';

// Punto de entrada raíz que Expo espera encontrar. La implementación real
// vive en app/App.tsx, siguiendo la estructura de carpetas del proyecto.
export { default } from './app/App';

import { getDeviceWalletAddress } from './app/services/blockchainService';
getDeviceWalletAddress().then(console.log);
