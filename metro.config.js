// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the pre-built kanji database (assets/data/kanji.sqlite) as an asset.
// Metro does not include .sqlite in its default assetExts.
config.resolver.assetExts.push('sqlite');

module.exports = config;
