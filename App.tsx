// Punto de entrada raíz que Expo espera encontrar. La implementación real
// vive en app/App.tsx, siguiendo la estructura de carpetas del proyecto.
export { default } from './app/App';
import { getDeviceWalletAddress } from './app/services/blockchainService';
getDeviceWalletAddress().then(console.log);