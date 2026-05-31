const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...resolver.sourceExts, "svg"],
  nodeModulesPaths: [path.resolve(__dirname, "node_modules")],
  // Map local native modules directly so Metro finds them without `npm install`
  // linking the file: entries in package.json.
  extraNodeModules: {
    "expo-app-monitor": path.resolve(__dirname, "modules/expo-app-monitor"),
    "expo-device-lock": path.resolve(__dirname, "modules/expo-device-lock"),
    "expo-usage-stats": path.resolve(__dirname, "modules/expo-usage-stats"),
  },
  // Stub out ExpoCryptoAES for Expo Go — the AES native module is not bundled
  // in standard Expo Go. expo-auth-session only needs SHA-256 (expo-crypto's
  // digestStringAsync), never AES, so the stub is safe for all OAuth flows.
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName.includes("ExpoCryptoAES")) {
      return {
        filePath: path.resolve(__dirname, "stubs/ExpoCryptoAES.js"),
        type: "sourceFile",
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
