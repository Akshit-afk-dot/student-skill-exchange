/* global __dirname */
const fs = require('fs');
const path = require('path');

/**
 * app.json holds the configuration. This file only adds what depends on files that may
 * not exist yet.
 *
 * google-services.json registers the Android app with Firebase, which Android push needs.
 * Each developer downloads it from the Firebase console (docs/INTEGRATIONS.md). Until it is
 * there, the app still builds and runs; it just cannot receive push notifications.
 */
module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
