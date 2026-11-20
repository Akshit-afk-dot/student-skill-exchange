const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Copies the per-category notification icons into the Android app's resources.
 *
 * Android shows a small white symbol in the status bar and the notification header. One
 * symbol per kind of notification (a speech bubble for messages, an alarm for reminders)
 * says what arrived before it is read. The server names the icon in each push
 * (`icon: 'notification_messages'`, see server/src/modules/notifications/push.ts), and
 * Android falls back to the app's own mark (`notification_icon`, from the expo-notifications
 * plugin) for anything it cannot find.
 *
 * The PNGs are drawn by assets/source/generate_art.py at every screen density.
 */
module.exports = function withNotificationIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const source = path.join(cfg.modRequest.projectRoot, 'assets', 'notifications', 'android');
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const folder of fs.readdirSync(source)) {
        const from = path.join(source, folder);
        if (!fs.statSync(from).isDirectory()) continue;
        const to = path.join(res, folder);
        fs.mkdirSync(to, { recursive: true });
        for (const file of fs.readdirSync(from)) {
          if (file.endsWith('.png')) fs.copyFileSync(path.join(from, file), path.join(to, file));
        }
      }
      return cfg;
    },
  ]);
};
