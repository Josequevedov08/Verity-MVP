// Configuración estándar de Babel para proyectos Expo. No requiere cambios
// para este MVP.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
