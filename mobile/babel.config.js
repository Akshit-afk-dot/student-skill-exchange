module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 compiles worklets through this plugin. It must be listed LAST,
      // or animations silently fall back to running on the JS thread.
      'react-native-worklets/plugin',
    ],
  };
};
