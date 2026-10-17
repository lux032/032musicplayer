<img src="assets/icons/256x256.png" alt="032musicplayer logo" title="032musicplayer" align="right" height="96px" width="96px" />

# 032musicplayer

> **032musicplayer is a desktop client for 032 Music Server, built on [Feishin](https://github.com/jeffvli/feishin) (GPL-3.0).**
> 本项目基于 Feishin 二次开发，在其 Plex 分支的基础上增加了 032 Music Server 支持，并沿用 Feishin 的 MPV 播放引擎（音频直通、独占模式、bit-perfect 输出）。
> Feishin 原作者及贡献者的版权与 GPL-3.0 许可证保持不变，见 [LICENSE](LICENSE)。
>
> 本项目是独立维护的 fork，与 Feishin 官方无关。使用中遇到的问题请在[本仓库](https://github.com/lux032/032musicplayer/issues)反馈，不要提交到 Feishin 上游。

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/lux032/032musicplayer?style=flat-square&color=brightgreen&cacheSeconds=3600" alt="License">
  </a>
  <a href="https://github.com/lux032/032musicplayer/releases">
    <img src="https://img.shields.io/github/v/release/lux032/032musicplayer?style=flat-square&color=blue&cacheSeconds=3600" alt="Release">
  </a>
  <a href="https://github.com/lux032/032musicplayer/releases">
    <img src="https://img.shields.io/github/downloads/lux032/032musicplayer/total?style=flat-square&color=orange&cacheSeconds=3600" alt="Downloads">
  </a>
</p>

---

## 功能

- 032 Music Server 支持：主页、作品、系列、每日推荐、播放记录、歌词
- MPV 播放引擎：音频直通、独占模式、bit-perfect 输出
- Web 播放引擎
- 同步与非同步歌词
- 032 Light / 032 Dark 内置主题，支持自定义主题

相对 Feishin 的改动详见 [MUSIC032_CHANGES.md](MUSIC032_CHANGES.md)。

## 安装

### 桌面端（推荐）

从 [Releases](https://github.com/lux032/032musicplayer/releases) 下载对应系统的安装包。

#### macOS

应用没有经过 Apple 签名公证，首次打开可能提示"已损坏"或"无法验证开发者"。把应用拖进"应用程序"文件夹后，在终端执行：

```sh
xattr -cr /Applications/032musicplayer.app
```

要使用媒体键，需要在系统设置中允许 032musicplayer 作为辅助功能客户端，允许后重启应用生效。

#### Linux

提供 AppImage、deb 和 tar.xz 三种格式。AppImage 下载后需要先加可执行权限：

```sh
chmod +x 032musicplayer-linux-*.AppImage
```

### Web 与 Docker

也可以自行构建 Web 版并用 Docker 运行（Web 版只支持 Web 播放引擎）：

```bash
docker build -t 032musicplayer .
docker run --name 032musicplayer -p 9180:9180 032musicplayer
```

或者使用仓库里的 [docker-compose.yaml](docker-compose.yaml)：

```bash
docker compose up -d --build
```

## 配置

1. 首次启动会提示选择 MPV 可执行文件路径。没有安装 MPV 的话，可以从[这里](https://mpv.io/installation/)下载，或用系统的包管理器安装。填好路径后重启应用。

2. 重启后按提示添加服务器：填写 032 Music Server 的完整地址（包含协议和端口，例如 `https://music.example.com` 或 `http://192.168.0.10:8080`），以及 **API Token** 和 **媒体凭据**。两者都在 032 Music Server 的 `/admin/settings/security` 页面查看，它们是两个不同的凭据。
    - **Linux 用户**：默认使用 `libsecret` 保存密码，也支持 `kwallet4/5/6`，需要在"设置 > 窗口 > 密码/密钥存储"中手动选择。

3. _可选_：Web 版部署在子路径（不是 `/`）时，设置环境变量 `PUBLIC_PATH`，例如 `PUBLIC_PATH=/music`。

4. _可选_：Web 版可以用环境变量预设服务器：`SERVER_NAME`、`SERVER_TYPE`（填 `music032`）、`SERVER_URL`。三项都设置后，再设置 `SERVER_LOCK=true` 可以禁止用户修改。

5. _可选_：首次运行时，可以用 `FS_` 前缀的环境变量覆盖应用设置（例如 `FS_GENERAL_LANGUAGE=zh-Hans`），完整列表见[设置环境变量文档](docs/ENV_SETTINGS.md)。

## 常见问题

### MPV 无法工作，或者在暂停和播放之间来回跳

先确认 MPV 路径是否正确：在设置页重新选择路径并重启应用。仍然不行的话尝试重装 MPV。已知可用的版本包括 `v0.35.x` 和 `v0.36.x`，`v0.34.x` 已知有问题。

### Linux 上提示 "The SUID sandbox helper binary was found, but is not configured correctly"

这是因为系统关闭了非特权用户命名空间（`sysctl kernel.unprivileged_userns_clone` 返回 0）。可以开启非特权命名空间，或者给 `chrome-sandbox` 设置 Setuid：

```bash
chmod 4755 chrome-sandbox
sudo chown root:root chrome-sandbox
```

Ubuntu 24.04 修改了命名空间的工作方式，可能的解决方法见 [Ubuntu 24.04 发行说明](https://discourse.ubuntu.com/t/ubuntu-24-04-lts-noble-numbat-release-notes/39890)。

### 怎么添加自定义主题？

桌面端可以把 JSON 主题文件放进主题文件夹（设置 > 通用 > 主题 > 打开文件夹）。文件格式和示例见[自定义主题文档](docs/CUSTOM_THEMES.md)。

## 开发

基于 [electron-vite](https://github.com/alex8088/electron-vite) 构建，使用 pnpm。

- `pnpm run dev` - 启动开发服务器
- `pnpm run dev:watch` - 以 watch 模式启动（main / preload 热更新）
- `pnpm run start` - 以生产预览模式启动
- `pnpm run build` - 构建桌面端
- `pnpm run build:web` - 构建独立 Web 版
- `pnpm run package:linux` / `package:mac` / `package:win` - 本地打包对应平台
- `pnpm run typecheck` - 类型检查
- `pnpm run lint` - 代码检查
- `pnpm run lint:fix` - 代码检查并自动修复
- `pnpm run test:music032` - 032 相关单元测试（需要 Node >= 22.18）

## 致谢

- [Feishin](https://github.com/jeffvli/feishin) 及其所有贡献者，本项目的绝大部分代码来自 Feishin
- [Sonixd](https://github.com/jeffvli/sonixd)，Feishin 的前身

## 许可证

[GNU General Public License v3.0](LICENSE)

本项目是 [Feishin](https://github.com/jeffvli/feishin) 的修改版本，以相同的 GPL-3.0 许可证发布。Feishin 原作者及贡献者的版权保持不变。
