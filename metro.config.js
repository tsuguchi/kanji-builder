// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the pre-built kanji database (assets/data/kanji.sqlite) as an asset.
// Metro does not include .sqlite in its default assetExts.
config.resolver.assetExts.push('sqlite');

// expo-sqlite's web implementation imports wa-sqlite.wasm via `import`.
// Add 'wasm' to assetExts so Metro treats it as an asset (returns a URL
// string) instead of trying to parse it as JS. Without this the web
// export fails on `import wasmModule from './wa-sqlite/wa-sqlite.wasm'`.
config.resolver.assetExts.push('wasm');

module.exports = config;
