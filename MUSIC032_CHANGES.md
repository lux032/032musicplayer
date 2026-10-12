# 032music 分支 - 相对 plex 分支的改动

本文件是 `032music` 分支相对 `plex` 分支所有有意改动的清单。`plex` 分支相对上游
的改动见 [PLEX_CHANGES.md](PLEX_CHANGES.md)（本分支不修改该文件）。

同步链路：`upstream/development` → `plex` → `032music`。每次把 `plex` 合入
`032music` 前后都对照本文件，决定冲突时保留什么。

本分支产物是 **032musicplayer**：基于 Feishin 二次开发的 032 Music Server 桌面
客户端，复用 Feishin 的 MPV 播放引擎（音频直通、独占模式、bit-perfect）。

---

## 新增文件（仅 032music 分支）

| 文件 | 用途 |
|------|------|
| `src/shared/api/music032/music032-types.ts` | 032 API v1 响应类型，以 `032music-server/internal/storage` 的 Go 结构体为准 |
| `src/shared/api/music032/music032-normalize.ts` | 032 → feishin 领域类型的规范化；媒体 URL 统一带 `mediaToken` |
| `src/renderer/api/music032/music032-api.ts` | HTTP 客户端：Bearer API Token，非 2xx 转 `Music032ApiError`，401 触发重新登录 |
| `src/renderer/api/music032/music032-controller.ts` | controller 接口实现（方法对照见下文） |
| `src/renderer/api/music032/music032-playback-session.ts` | 播放会话协议（apiRevision 3）纯逻辑模块，移植自 032 的 `playback-reporter.js` |
| `src/renderer/api/music032/music032-playback-adapter.ts` | feishin 播放器信号 → 会话协议的纯逻辑适配层 |
| `src/renderer/features/player/hooks/use-music032-playback-reporter.ts` | 把播放器 store / 引擎事件接到适配层的 hook |
| `src/renderer/features/servers/components/music032-credential-fields.tsx` | API Token + 媒体凭据输入框（添加、编辑、server-lock 登录共用） |
| `src/renderer/features/servers/assets/music032.png` | 服务端图标，取自 032 的 `internal/http/assets/icon-192.png` |
| `scripts/music032/playback-reporter.test.mjs` | 上报状态机单元测试，`pnpm test:music032`（需 Node >= 22.18） |
| `MUSIC032_CHANGES.md` | 本文件 |

**合并规则：** 这些文件 plex 和上游都没有，不会冲突。plex 或上游重命名了它们依赖的
类型或 hook（如 `usePlayerEvents`、`InternalControllerEndpoint`、`ServerFeature`）时，
以 `pnpm run typecheck` 报错为准跟着改。

---

## 修改的共享文件

### `src/shared/types/domain-types.ts`、`src/shared/types/types.ts`
- 两个 `ServerType` 枚举都加 `MUSIC032 = 'music032'`；`toServerType` 加对应分支。
- `ServerListItemWithCredential` 加可选字段 `mediaToken`；`AuthenticationResponse` 加可选字段 `mediaToken`。
- **合并规则：** 保留 `MUSIC032` 和 `mediaToken`，其余全部取对方的改动。

### `src/renderer/api/controller.ts`
- 分发表加 `music032: Music032Controller`。
- **合并规则：** 冲突时保留 `music032` 两行（类型和值），其余取对方。

### `src/renderer/store/auth.store.ts`
- `logout()` 同时清空 `mediaToken`。401 不清空媒体凭据，所以 API Token 被轮换后，重新登录只需要填 API Token。
- **合并规则：** 保留 `server.mediaToken = undefined;` 这一行。

### 登录和服务器表单
`add-server-form.tsx`、`edit-server-form.tsx`、`login-route.tsx`、`server-required.tsx`
- 032 走 token 登录：API Token 复用 Plex 的 token 字段（添加表单用 `token`，编辑表单和 server-lock 登录用 `password`），另加 `mediaToken` 字段，提交时带上 `mediaToken`，并把 `data.mediaToken` 写回服务器记录。
- 编辑表单里两个凭据留空都表示沿用已保存的值。
- `server-required.tsx`：缺 `credential` 或 `mediaToken` 时视为会话过期，点击后打开编辑表单重新登录。
- **合并规则：** 保留所有 `MUSIC032` / `isMusic032` / `mediaToken` 分支；对方改了 Plex 分支的表单逻辑时，同步检查 032 分支是否需要同样改动。

### 图标三元表达式
`server-list.tsx`、`server-selector.tsx`、`server-selector-items.tsx`、`collapsed-sidebar.tsx`、`server-required.tsx`
- 在 `PLEX` 分支前插入 `MUSIC032 ? Music032Logo`。
- **合并规则：** 保留 `Music032Logo` 的 import 和那一个分支。

### `src/renderer/features/shared/components/list-sort-by-dropdown.tsx`
- 每张排序表都加 `[ServerType.MUSIC032]`，只列出 032 真正支持的排序（专辑：名称、最近添加、最近播放、发行日期、发行年份；歌曲：专辑、名称、播放次数、最近播放、发行日期、年份；艺人：名称、专辑数、歌曲数；歌单：名称、时长、歌曲数）。
- `ListSortByDropdown` 直接用 `FILTERS[itemType][server.type]` 取表，**缺一项就会运行时报错**。
- **合并规则：** 保留所有 `MUSIC032` 条目；上游新增一张排序表时必须补一条 `MUSIC032`（不支持就给 `[]`）。

### `src/renderer/features/shared/components/list-filters.tsx`
- `MUSIC032` 复用 Subsonic 的专辑、歌曲筛选器（收藏、艺人、流派、年份区间）。
- **合并规则：** 保留 `MUSIC032` 条目。

### `src/i18n/locales/en.json`、`zh-Hans.json`、`zh-Hant.json`
- 新增 `error.music032*`（5 个）和 `form.addServer.input_music032*`（5 个）。
- **合并规则：** 接受对方的措辞改动；对方删掉这些 key 时要加回来。

### 播放上报接线
- `src/renderer/features/player/components/audio-players.tsx`：在 `<ScrobbleHook />` 后挂载 `<Music032PlaybackReporterHook />`。
- `src/renderer/events/events.ts`：新增 `PLAYER_BUFFERING`、`PLAYER_ERROR` 事件。
- `src/renderer/features/player/audio-player/engine/web-player-engine.tsx`：活动播放器的 `onBuffer`/`onBufferEnd` 发出 `PLAYER_BUFFERING`；`handleOnError` 的最终失败分支（重试用尽或无法解码）在活动播放器上发出 `PLAYER_ERROR`。
- `src/main/features/core/player/index.ts`：`createMpv` 里观察 `paused-for-cache`，转发为 `renderer-player-buffering`；监听 node-mpv 原始 socket 的 `end-file`，`reason === 'error'` 时转发为 `renderer-player-load-error`。
- `src/preload/mpv-player.ts`：`mpvPlayerListener` 增加 `rendererBuffering`、`rendererLoadError`。
- **合并规则：** 这些都是追加的几行，保留即可。上游改了 `handleOnError` 的结构时，把 `PLAYER_ERROR` 放回"最终失败、准备跳过或暂停"的位置，**不要**放在网络重试分支里。上游改了 `createMpv` 时，保留 `observeProperty('paused-for-cache')` 和 socket `message` 监听。
- `use-scrobble.ts` **没有改**：032 的 `controller.scrobble` 是空操作，也不声明 `REPORT_PLAYBACK`。

### 应用身份
- `electron-builder.yml`、`electron-builder-alpha.yml`、`electron-builder-beta.yml`：`appId: org.lux032.musicplayer032`，`productName: 032musicplayer`，`publish.repo: 032musicplayer`。
- `package.json`：`productName: 032musicplayer`；新增脚本 `test:music032`。
- `src/main/fork-config.ts`：`APP_ID`、`UPDATER_OWNER`、`UPDATER_REPO`、`AUTO_UPDATE_ENABLED = false`。发版仓库是私有的，electron-updater 读私有仓库需要把 GitHub Token 打进安装包，所以默认关闭自动更新。
- `src/main/index.ts`：从 fork-config 读取 `APP_ID`、`UPDATER_REPO`，`new AppUpdater()` 额外受 `AUTO_UPDATE_ENABLED` 控制。
- `README.md`：标题和开头注明 032musicplayer 基于 Feishin 二次开发。
- **合并规则：** 这些文件的 plex 版本是 `Feishin-plex` / `org.jeffvli.feishin` / `repo: feishin`，**合并时一律保留 032music 的值**，其余字段（文件列表、target、mac 配置等）取 plex。`fork-config.ts` 在本分支整个文件以本分支为准。`main/index.ts` 只保留 fork-config 的 import 和三处引用，其余取 plex。
- 未改：Linux 的 `org.jeffvli.feishin.metainfo.xml`（只在打 Linux 包时用到）。

---

## 功能开关（`getServerInfo`）

| 开关 | 条件 |
|------|------|
| `TOP_SONGS_BY_ARTIST_ID` | 总是声明 |
| `LYRICS_SINGLE_STRUCTURED` | capabilities `features.lyrics` |
| `PLAYLIST_IMAGE_UPLOAD` | capabilities `features.playlistArtwork` |

不声明：`REPORT_PLAYBACK`（上报走专用模块）、`STAR_RATING`、`SERVER_PLAY_QUEUE`、
`SHARING_ALBUM_SONG`、`PUBLIC_PLAYLIST`、`PLAYLISTS_SMART`、`TAGS`、`JUKEBOX`、
`ARTIST_IMAGE_UPLOAD`、`MUSIC_FOLDER_MULTISELECT`。

---

## 不支持（D 类）

| 方法 | 行为 |
|------|------|
| `getFolder`、`getPlayQueue`、`refreshItems`、`startLibraryScan`、网络电台写操作 | 抛出"该服务端未实现" |
| `getMusicFolderList`、`getGenreList`、`getInternetRadioStations`、`getRoles` | 返回空列表（`getGenreList` 等 C1） |
| `getScanStatus` | `{ scanning: false }` |
| `savePlayQueue`、`scrobble` | 空操作 |
| `setRating`、`shareItem`、`jukeboxControl`、艺人图片上传/删除、`getUserList`、`getTagList` | 不实现 |
| 歌单收藏 | 抛出"不支持"（032 只有专辑、曲目、艺人收藏） |

## 已知限制（客户端侧）

- **排序方向**：032 每种排序的方向固定，界面上的升序/降序切换对 032 列表无效（等 C2）。
- **多值筛选**：artist / genre / album 筛选只取第一个值；多张专辑会逐个请求再拼接。
- **专辑年份**：专辑列表只能按单个年份精确筛选（`minYear == maxYear`）；歌曲列表支持区间。
- **随机歌曲**：在一个随机窗口里抽样，不是全库均匀随机（等 C3）。
- **列表里的专辑艺人**：专辑列表、曲目里没有专辑艺人的 id，专辑艺人链接只在专辑详情页可用（等 C7）。
- **收藏**：032 的 `/albums`、`/tracks` 会忽略 `favorite=true`（只有 `/artists` 支持），所以收藏页的专辑和歌曲改走 `/favorites/albums`、`/favorites/tracks`，一次取回全部收藏，筛选、排序、分页在客户端完成。
- **歌单重复曲目**：032 歌单里同一首歌只出现一次，重复添加会被服务端跳过。
- **MPV 载入失败**的结束原因是 `error`（依赖 end-file 转发）；其他 MPV 异常退出不上报，服务端租约到期后按 interrupted 处理。
- **应用关闭**用 `navigator.sendBeacon` 尽力发送 `client_closed`，失败也只是租约到期，不会多计数。
- **clientKind** 暂时报 `web`（等 C4）。

---

## 需要 032 后端补的接口（C 类）

约束：**只新增接口，不修改已有接口**（MusicBridge 等客户端依赖现有接口）。

| # | 新接口 | 说明 |
|---|--------|------|
| C1 | `GET /api/v1/genres` → `{items:[{name, albumCount, trackCount}]}` | 流派列表和流派页。鉴权同 `requireAPIOrAdmin` |
| C2 | `GET /api/v1/browse/albums`、`/browse/tracks`、`/browse/artists` | 新的列表接口族：接受现有 `filters()` 的全部参数，外加 `order=asc\|desc`；返回 `{items,total,limit,offset}`。现有 `/albums` 等保持不变 |
| C3 | 同上 browse 接口支持 `sort=random&seed=<n>` | 同一个 seed 下分页结果稳定；`/browse/tracks` 额外支持 `sort=added`、`sort=duration` |
| C4 | 播放事件 `clientKind` 接受 `desktop` | 只放宽枚举校验，不改变语义。若不想动现有接口，客户端会一直报 `web` |
| C5 | `POST /api/v1/scan`、`GET /api/v1/scan/status` → `{scanning, count, lastScan}` | Bearer 可用的扫描触发和状态。现在只有 `/admin/scan`（需要会话） |
| C6 | `GET /api/v1/media/ping` → 204（走 `requireMediaAccess`） | 登录时校验媒体凭据。现在用"取一首曲目 + Range 0-0"代替，曲库为空时无法校验 |
| C7 | C2 的 browse 接口里，曲目带 `albumArtists:[{id,name}]`、专辑带 `artists:[{id,name}]` | 列表里的专辑艺人可点击跳转 |
| C8 | C2 的 `/browse/albums` 支持 `yearFrom`/`yearTo` | 与 `/tracks` 一致 |
| C10（可选） | `GET /api/v1/server-info` → `{libraryName}` | 界面上显示的用户名，现在固定为 `032` |

（原 C9"专辑详情超过 500 首"已在客户端解决：`trackCount` 大于嵌入的曲目数时改用 `/tracks?album=` 分页补齐。）

---

## 合并流程

```bash
git fetch origin
git switch 032music
git merge origin/plex          # 不直接合并 upstream
# 按本文件的规则解决冲突
pnpm run typecheck
pnpm run lint
pnpm run test:music032
```
