/**
 * Fork-specific build constants.
 *
 * On the 032music branch this file identifies the app as 032musicplayer, a
 * desktop client for 032 Music Server based on feishin. Keep it minimal - one
 * constant per intentional divergence so merge conflicts stay isolated here
 * rather than scattered through shared files.
 */

/** Must match `appId` in electron-builder*.yml (Windows taskbar grouping, notifications). */
export const APP_ID = 'org.lux032.musicplayer032';

/** GitHub owner used by electron-updater. */
export const UPDATER_OWNER = 'lux032';

/** GitHub repository used by electron-updater. */
export const UPDATER_REPO = '032musicplayer';

/**
 * 032musicplayer releases live in a private repository, which electron-updater
 * can only read with a GitHub token embedded in the app. Auto-update stays off
 * until there is a public or token-free update feed.
 */
export const AUTO_UPDATE_ENABLED = false;
