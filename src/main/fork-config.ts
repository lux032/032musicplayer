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
 * The release repository is public, so electron-updater reads its GitHub
 * releases without a token. Updates are detected by version: the publish
 * workflow overwrites assets of the current version, so only a version bump
 * reaches installed clients. macOS only gets the (hidden) update dialog signal,
 * so in practice this updates Windows (NSIS) and Linux (AppImage) builds.
 */
export const AUTO_UPDATE_ENABLED = true;
