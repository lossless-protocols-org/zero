const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const {assetExts, sourceExts} = defaultConfig.resolver;
/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
/**
 * zod's every-language messages, replaced by English only
 * (scripts/metro/zod-locales-en.js explains why). Matched on the resolved file,
 * so a zod that moves it simply stops matching; __tests__/scripts/metroConfig
 * fails when that happens, so the saving is not lost unnoticed.
 */
const ZOD_LOCALES = path.join(__dirname, 'node_modules', 'zod', 'v4', 'locales', 'index.js');
const ZOD_LOCALES_EN = path.join(__dirname, 'scripts', 'metro', 'zod-locales-en.js');

const resolveRequest = (context, moduleName, platform) => {
  const resolution = context.resolveRequest(context, moduleName, platform);
  return resolution.type === 'sourceFile' && resolution.filePath === ZOD_LOCALES
    ? {type: 'sourceFile', filePath: ZOD_LOCALES_EN}
    : resolution;
};

const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    // Enable inline requires for faster startup - defers module loading until first use
    inlineRequires: true,
  },
  resolver: {
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    resolveRequest,
  },
};

module.exports = mergeConfig(defaultConfig, config);
module.exports.ZOD_LOCALES = ZOD_LOCALES;
