const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// O Expo detecta o monorepo pnpm automaticamente (watchFolders / nodeModulesPaths).
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
