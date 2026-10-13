# 032musicplayer - 相对 Feishin 的改动记录

**032musicplayer** 是基于 Feishin 二次开发的 032 Music Server 桌面客户端，复用
Feishin 的 MPV 播放引擎（音频直通、独占模式、bit-perfect）。

项目最初从 Feishin 的 Plex 分叉（`lux032/feishin` 的 `plex` 分支）派生，2026-10 起
**独立维护，不再跟随上游**，也不再合并 Feishin 或 plex 分支。本文件记录相对 Feishin
原版的有意改动，方便定位代码和日后需要回看或移植上游修复时参考。

---

## 新增文件

| 文件 | 用途 |
|------|------|
| `src/shared/api/music032/music032-types.ts` | 032 API v1 响应类型（含主页 `/api/v1/home*` 类型），以 `032music-server/internal/storage` 的 Go 结构体和 `docs/api/home.md` 为准 |
| `src/shared/api/music032/music032-normalize.ts` | 032 → feishin 领域类型的规范化；媒体 URL 统一带 `mediaToken` |
| `src/renderer/api/music032/music032-api.ts` | HTTP 客户端：Bearer API Token，非 2xx 转 `Music032ApiError`，401 触发重新登录 |
| `src/renderer/api/music032/music032-controller.ts` | controller 接口实现（方法对照见下文） |
| `src/renderer/api/music032/music032-playback-session.ts` | 播放会话协议（apiRevision 3）纯逻辑模块，移植自 032 的 `playback-reporter.js` |
| `src/renderer/api/music032/music032-playback-adapter.ts` | feishin 播放器信号 → 会话协议的纯逻辑适配层 |
| `src/renderer/features/player/hooks/use-music032-playback-reporter.ts` | 把播放器 store / 引擎事件接到适配层的 hook |
| `src/renderer/features/servers/components/music032-credential-fields.tsx` | API Token + 媒体凭据输入框（添加、编辑、server-lock 登录共用） |
| `src/renderer/features/servers/assets/music032.png` | 服务端图标，取自 032 的 `internal/http/assets/icon-192.png` |
| `src/renderer/features/home/music032/` | 032 主页（按 032 网页主页设计重写）：路由根、数据层、聚焦卡 / 接着听 / 最近添加 / 作品轮换 / 主题曲轮换 / 编年 / 歌单 / 页脚统计 / 空库引导，样式走 feishin 主题变量 |
| `src/renderer/features/works/` | 客户端内作品页：列表（搜索 / 类型 / 排序 / 无限滚动）和详情（hero、系列横幅、关联专辑 + 曲目用途、收录曲目列表、404 态） |
| `src/renderer/features/series/` | 客户端内系列页：列表（搜索）和详情（统计、播放全部、按类型分组的成员、系列专辑）；接口缺失时的网页回退块 |
| `src/renderer/features/shared/components/music032/` | 032 页面共享件：海报卡（作品 / 专辑）、曲目行、骨架 / 空 / 错误 / 404 状态块、页面样式模块 |
| `src/renderer/features/shared/components/playing-indicator/` | 正在播放指示：均衡器竖条组件（暂停冻结、prefers-reduced-motion 静态、主题色）、id+服务器 id 判定纯函数、hooks |
| `src/renderer/features/shared/components/music032-route-guard.tsx` | 作品 / 系列路由守卫：非 MUSIC032 服务端访问时重定向主页 |
| `src/renderer/features/shared/hooks/use-music032-capabilities.ts` | `/capabilities` 查询与 `useMusic032SeriesSupported`（系列能力位） |
| `src/renderer/features/shared/hooks/use-music032-sidebar-items.ts` | 侧边栏注入项（作品 / 系列，仅 MUSIC032，不进持久化设置；系列接口缺失时系列入口打开网页） |
| `src/renderer/features/radio/hooks/use-radio-supported.ts` | 电台能力判定：只有 MUSIC032 按 INTERNET_RADIO 能力位隐藏，其他类型行为不变 |
| `src/renderer/features/radio/components/radio-route-guard.tsx` | `/radio` 直接访问在无电台能力时重定向主页 |
| `scripts/music032/playback-reporter.test.mjs` | 上报状态机单元测试，`pnpm test:music032`（需 Node >= 22.18） |
| `scripts/music032/playing-indicator.test.mjs` | 播放态判定纯函数 + 作品/系列→曲目会话映射的单元测试 |
| `src/shared/themes/music032-light/`、`music032-dark/` | 032 Light / 032 Dark 内置主题，配色取自 032 网页 `internal/http/assets/tokens.css`（中性灰阶 + 紫色单一强调：浅 `#5b47e0` / 深 `#8d7dff`，深色主题强调色上用深色字 `#140f33`） |
| `src/shared/themes/music032/` | 两套 032 主题共用：`music032-tokens.ts` 输出 `--m032-*` 补充 token（fill / line / panel / accent-soft 等），`music032_overrides.css` 按 `data-theme^='music032'` 覆盖壳层（侧栏同底、右面板与播放条面板色、侧栏选中灰底紫图标、浮层面板色+细边+阴影、输入框聚焦紫边、选中行紫色浅底、裸链接颜色） |
| `MUSIC032_CHANGES.md` | 本文件 |

这些文件依赖的共享接口（如 `usePlayerEvents`、`InternalControllerEndpoint`、
`ServerFeature`）改名或改签名时，以 `pnpm run typecheck` 报错为准跟着改。032 主页额外依赖：`MemoizedItemCard` /
`useDefaultItemListControls` / `ContextMenuController.call` / `useSetFavorite` /
`useResumePosition`（续播靠 `Song.resumePositionMs`）/ `getTitlePath` / `ItemImage` /
`usePlayerSong` / `usePlayerStatus`（正在播放标识），作品 / 系列页还依赖
`NativeScrollArea` / `LibraryContainer` / `LibraryHeaderBar` / `AnimatedPage`。

---

## 修改的共享文件

### `src/shared/types/domain-types.ts`、`src/shared/types/types.ts`
- 两个 `ServerType` 枚举都加 `MUSIC032 = 'music032'`；`toServerType` 加对应分支。
- `ServerListItemWithCredential` 加可选字段 `mediaToken`；`AuthenticationResponse` 加可选字段 `mediaToken`。

### `src/renderer/api/controller.ts`
- 分发表加 `music032: Music032Controller`。

### `src/renderer/features/home/routes/home-route.tsx`
- 032 主页分流：原 `HomeRoute` 主体原样改名为 `DefaultHomeContent`，新的 `HomeRoute`
  只做分流：服务端类型是 `MUSIC032` 时渲染 `<Music032HomeRoute fallback={<DefaultHomeContent />} />`，
  后端没有主页接口（`/api/v1/home` 返回 404/501）时由 `Music032HomeRoute` 渲染 fallback。

### `src/renderer/api/query-keys.ts`
- 追加 `home` 命名空间（`overview` / `works` / `songs` / `chronicle` / `root`），
  供 032 主页使用；`batch` / `generation` / `type` / `year` 进 key。
- 追加 `music032`（`capabilities`）、`works`（`list` / `detail` / `albums` / `tracks` / `root`）、
  `series`（同名）命名空间，供作品页、系列页和能力位查询使用。

### `src/renderer/router/routes.ts`、`src/renderer/router/app-router.tsx`
- `AppRoute` 追加 `LIBRARY_WORKS` / `LIBRARY_WORKS_DETAIL` / `LIBRARY_SERIES` / `LIBRARY_SERIES_DETAIL`；
  四条路由挂在 `Music032RouteGuard` 下（非 MUSIC032 重定向主页）。
- `/radio` 路由包一层 `RadioRouteGuard`（无 `INTERNET_RADIO` 能力位时重定向主页）。

### `src/shared/types/features-types.ts` 和各 controller 的 `getServerInfo`
- `ServerFeature` 新增 `INTERNET_RADIO = 'internetRadio'`；Plex / Jellyfin / Subsonic
  controller 声明 `[1]`（Navidrome 继承 Subsonic 的 features），music032 **不声明**。

### `src/renderer/store/auth.store.ts`
- `logout()` 同时清空 `mediaToken`。401 不清空媒体凭据，所以 API Token 被轮换后，重新登录只需要填 API Token。

### 登录和服务器表单
`add-server-form.tsx`、`edit-server-form.tsx`、`login-route.tsx`、`server-required.tsx`
- 032 走 token 登录：API Token 复用 Plex 的 token 字段（添加表单用 `token`，编辑表单和 server-lock 登录用 `password`），另加 `mediaToken` 字段，提交时带上 `mediaToken`，并把 `data.mediaToken` 写回服务器记录。
- 编辑表单里两个凭据留空都表示沿用已保存的值。
- 改 Plex 的表单逻辑时，同步检查 `isMusic032` 那一支是否需要同样改动。
- `server-required.tsx`：缺 `credential` 或 `mediaToken` 时视为会话过期，点击后打开编辑表单重新登录。

### 图标三元表达式
`server-list.tsx`、`server-selector.tsx`、`server-selector-items.tsx`、`collapsed-sidebar.tsx`、`server-required.tsx`
- 在 `PLEX` 分支前插入 `MUSIC032 ? Music032Logo`。

### 侧边栏组件（`sidebar.tsx`、`collapsed-sidebar.tsx`、`mobile-sidebar.tsx`、`sidebar-icon.tsx`、`collapsed-sidebar-item.tsx`）
- 条目 memo 的过滤条件加 `(item.id !== 'Radio' || radioSupported)`，
  `radioSupported` 来自 `useInternetRadioSupported()`（MUSIC032 未声明 `INTERNET_RADIO` 时隐藏电台）；
  memo 末尾在 `Genres` 后 splice 注入 `useMusic032SidebarItems()` 的作品 / 系列项
  （id 为 `M032Works` / `M032Series`，不进持久化设置），条目渲染透传 `onClick`。
- `sidebar-icon.tsx`：`LIBRARY_WORKS` / `LIBRARY_SERIES` 两个 case（RiBookOpen / RiStack）。
- `collapsed-sidebar-item.tsx`：props 增加可选 `onClick`（原本就透传其余 props 到 Flex）。

### `src/renderer/features/settings/components/general/sidebar-reorder.tsx`
- 电台不受支持时从排序列表里隐藏 Radio 行；`setItemsPreservingRadio` 保证隐藏期间
  重排不丢持久化的 Radio 设置项。

### `src/renderer/features/shared/components/list-sort-by-dropdown.tsx`
- 每张排序表都加 `[ServerType.MUSIC032]`，只列出 032 真正支持的排序（专辑：名称、最近添加、最近播放、发行日期、发行年份；歌曲：专辑、名称、播放次数、最近播放、发行日期、年份；艺人：名称、专辑数、歌曲数；歌单：名称、时长、歌曲数）。
- `ListSortByDropdown` 直接用 `FILTERS[itemType][server.type]` 取表，**缺一项就会运行时报错**。
  新增排序表时必须补一条 `MUSIC032`（不支持就给 `[]`）。

### `src/renderer/features/shared/components/list-filters.tsx`
- `MUSIC032` 复用 Subsonic 的专辑、歌曲筛选器（收藏、艺人、流派、年份区间）。
- `ListFilters` 外层包一层 `<div style={{ display: 'contents' }}>`，修复 Feishin 原有的
  bug：调用方都把 `ListFilters` 直接放在 `ScrollArea` 里，OverlayScrollbars 会把根节点
  的子节点挪进它生成的 viewport；冷缓存时 Suspense 的 fallback 被挪走，筛选数据回来后
  React `removeChild` 抛 `NotFoundError`，筛选侧栏崩进错误边界（F5 后必现）。
  别去掉这层 div。

### `src/i18n/locales/en.json`、`zh-Hans.json`、`zh-Hant.json`
- 新增 `error.music032*`（5 个）和 `form.addServer.input_music032*`（5 个）。
- 新增 `page.home.music032*`（032 主页全部文案，含页签、区块标题、用途角色短标签、
  空库引导、页脚统计）。

### 播放上报接线
- `src/renderer/features/player/components/audio-players.tsx`：在 `<ScrobbleHook />` 后挂载 `<Music032PlaybackReporterHook />`。
- `src/renderer/events/events.ts`：新增 `PLAYER_BUFFERING`、`PLAYER_ERROR` 事件。
- `src/renderer/features/player/audio-player/engine/web-player-engine.tsx`：活动播放器的 `onBuffer`/`onBufferEnd` 发出 `PLAYER_BUFFERING`；`handleOnError` 的最终失败分支（重试用尽或无法解码）在活动播放器上发出 `PLAYER_ERROR`。
- `src/main/features/core/player/index.ts`：`createMpv` 里观察 `paused-for-cache`，转发为 `renderer-player-buffering`；监听 node-mpv 原始 socket 的 `end-file`，`reason === 'error'` 时转发为 `renderer-player-load-error`。
- `src/preload/mpv-player.ts`：`mpvPlayerListener` 增加 `rendererBuffering`、`rendererLoadError`。
- `PLAYER_ERROR` 只在"最终失败、准备跳过或暂停"的位置发出，**不要**放在网络重试分支里。
- `use-scrobble.ts` **没有改**：032 的 `controller.scrobble` 是空操作，也不声明 `REPORT_PLAYBACK`。

### 主题与配色（对齐 032 网页）
- `app-theme-types.ts` / `app-theme.ts`：注册 `MUSIC032_DARK` / `MUSIC032_LIGHT`，未知主题回退改为 032 Dark；`use-app-theme.ts` 的 `THEME_DATA` 把两套主题排在最前。
- `settings.store.ts`：默认跟随系统、浅/深分别 032 Light / 032 Dark、`useThemeAccentColor: true`、默认强调色 `#5b47e0`；迁移 v35 把仍在 Default Dark / Light 的用户换到对应 032 主题，强调色仍为 Feishin 默认蓝时一并换成紫色并启用主题强调色。
- `theme-settings.tsx`：强调色色板首位加 032 紫。
- 远程控制（`src/remote/app.tsx`、`use-remote-settings-push.tsx`）改用 032 主题。
- 032 页面卡片上的悬浮播放键文字色由 `#fff` 改为 `--theme-colors-primary-contrast`，深色主题下保持可读。
- 第二轮对照网页逐页修正：裸链接改为继承文字色、悬停才变紫；按钮改胶囊；详情页“播放”为紫色实底、“下一首播放 / 最后播放”为灰底；已收藏心形改红色（`state-error`）；缺图占位改浅灰块；表头改次要色；页头数量改纯文字；标签 Pill 灰底无边框；分段控件改灰底胶囊 + 浮起选中项；播放条空闲时播放键保持墨色。
- 为让主题能精确定位，`shared/components/icon/icon.tsx` 给 svg 加 `data-icon={icon}`；`play-button.tsx` 的 `PlayTextButton` 在默认“播放”（无自定义 children）上加 `data-primary`。两者对其他主题无视觉影响。
- 作品 / 系列页：`.page` 补左右 2rem 内边距（此前贴边、右侧数量被裁），列表页加页面标题；作品 / 系列详情与主页聚焦卡的“播放全部 / 播放”为 `filled` + 实心播放图标，“加入队列”为 `default` 灰底；聚焦卡、作品卡、系列横幅 / 行底色改用 `--m032-surface`（缺省回退 `--theme-colors-surface`）。
- 覆盖样式依赖 CSS Modules 固定类名 `fs-[name]-[local]`（`electron.vite.config.ts` / `web.vite.config.ts`），重命名相关组件或类名时需同步 `music032_overrides.css`。

### 音质信息与全屏封面
- `src/renderer/utils/audio-quality.ts`：`formatAudioQuality` 输出 `FLAC / 24bit / 48kHz`（有损格式第二段为 kbps），`getAlbumAudioQuality` 汇总专辑曲目（不一致时取最高并标“最高”，i18n `common.audioQualityUpTo`）。
- 播放条左侧第三行专辑名后、全屏播放器元数据区（不受“播放器项目”设置控制）、专辑详情页元数据行显示音质。
- `music032-controller.ts` 的 `getImageUrl`：`size` 为 0（全屏播放器默认“原图”）时不带 `size` 参数，032 服务端会拒绝 `size=0`，之前导致全屏封面裂图。

### 应用身份
- `electron-builder.yml`、`electron-builder-alpha.yml`、`electron-builder-beta.yml`：`appId: org.lux032.musicplayer032`，`productName: 032musicplayer`，`publish.repo: 032musicplayer`。
- `package.json`：`productName: 032musicplayer`；新增脚本 `test:music032`。
- `src/main/fork-config.ts`：`APP_ID`、`UPDATER_OWNER`、`UPDATER_REPO`、`AUTO_UPDATE_ENABLED = false`。发版仓库是私有的，electron-updater 读私有仓库需要把 GitHub Token 打进安装包，所以默认关闭自动更新。
- `src/main/index.ts`：从 fork-config 读取 `APP_ID`、`UPDATER_REPO`，`new AppUpdater()` 额外受 `AUTO_UPDATE_ENABLED` 控制。
- `README.md`：标题和开头注明 032musicplayer 基于 Feishin 二次开发。
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
`ARTIST_IMAGE_UPLOAD`、`MUSIC_FOLDER_MULTISELECT`、`INTERNET_RADIO`（032 没有电台，
界面入口随之隐藏）。

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

- **032 主页**：作品和系列已有客户端内页面（`/library/works*`、`/library/series*`），主页、专辑页等
  入口统一走客户端路由；「在网页中打开」作为页面内的次要操作保留（编辑、管理用）。
  网页主页的搜索框未移植（feishin 有全局搜索）；「接着听」的「播放记录」和页脚「待审核」同样跳网页。
- **作品卡片播放徽标**：作品 / 系列卡片的播放态来自会话级“作品→曲目”映射（播放展开时记录，
  上限 200 条）；从专辑页等其他入口开始播放时不亮（等 C11）。
- **作品列表首字母索引**：`/works` 的 `index` 参数客户端暂未使用（网页有首字母索引栏）。
- **系列接口回退**：服务端没有系列能力位或返回 404 时，侧边栏「系列」入口打开网页，
  系列路由页显示降级块；作品详情在旧服务端上没有系列横幅和 Bangumi 链接（字段缺失按无处理）。
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
| C11 | `GET /api/v1/tracks/{id}/works` → `{items:[{id,title}]}`（或在曲目对象里带 `works`） | 作品 / 系列卡片的“正在播放”徽标精确化；现在是会话级映射，只有从卡片 / 作品页 / 系列页开始播放才亮 |

（原 C9"专辑详情超过 500 首"已在客户端解决：`trackCount` 大于嵌入的曲目数时改用 `/tracks?album=` 分页补齐。）

---

## 继承自 Plex 分叉的改动

派生时 plex 分支已有的改动（原 `PLEX_CHANGES.md`，已删除），现在属于本项目代码：

- **Plex 服务端支持：** `src/renderer/api/plex/plex-api.ts`、`plex-controller.ts`（实现全部
  controller 接口；`getSimilarSongs` 走 Plex 的 `/nearest` 声波相似接口，非 200 时返回 `[]`，
  不抛错）；`ServerType.PLEX` 枚举、`controller.ts` 分发、`list-filters.tsx` 里
  `FILTERS[PLEX]` 复用 Subsonic 筛选器（`FILTERS[serverType]?.[itemType]` 容忍没有筛选器的类型）。
- **评分：** `right-controls.tsx` 的 `RatingButton` 用 `hasFeature(server, ServerFeature.STAR_RATING)`
  判断（Plex 声明 `STAR_RATING`）；`FavoriteButton` 没有 Plex 守卫。
- **MPV：** `src/main/features/core/player/index.ts` 里 Plex 直连流 URL 的无损播放处理。
- **i18n：** `toast.plexTokenAuthenticationFailed`、`toast.plexTokenRequired`、
  `form.addServer.discoveredServer`（Plex 服务器发现）。
- **发布：** `fork-config.ts`、`.github/workflows/publish-*.yml`、`electron-builder*.yml`
  指向 `lux032` 账号（032 的具体值见上文"应用身份"）。

---

## 提交前检查

```bash
pnpm run typecheck
pnpm run lint
pnpm run test:music032
```
