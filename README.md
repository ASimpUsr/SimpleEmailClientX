# Simple Email Client X / 简易邮件客户端 X

简体中文（简短说明）

Simple Email Client X 是一个轻量、跨平台的桌面邮件客户端，基于 Electron 开发，目标是提供直观的邮件收发、预览、分页与移动功能，支持 IMAP/SMTP 与 Microsoft Graph（Outlook/Office365）账户。

主要功能：
- 账户管理（支持自定义 IMAP/SMTP、Microsoft 登录）
- 邮件列表分页与“加载更多”功能，支持单页大小配置
- 右侧邮件预览与安全沙箱（可配置是否允许邮件内 JavaScript）
- 双击打开邮件预览窗口
- 邮件移动：支持 IMAP 的 messageMove 与 Microsoft Graph 的 move API
- 邮件发送、删除、附件预览（部分协议受限）

English (Short Overview)

Simple Email Client X is a lightweight cross-platform desktop email client built with Electron. It provides intuitive mail viewing and management with support for IMAP/SMTP and Microsoft Graph (Outlook/Office365) accounts.

Key features:
- Account management (custom IMAP/SMTP and Microsoft OAuth)
- Paginated message list with configurable page size and "load more"
- Secure mail preview with sandbox options for embedded JavaScript
- Double-click to open a dedicated preview window
- Move messages (IMAP messageMove and Microsoft Graph move API)
- Send and delete messages; preview attachments when available

快速开始 / Quick start

开发模式（开发运行）：
```bash
npm install
npm run dev
```

生成 Windows 便携版：
```bash
npm run build:portable
# 产物位于 dist/ 目录，例如 Simple Email Client X-1.0.0-portable.exe
```

在 Linux 下构建 AppImage（推荐在 WSL 或 Linux 环境）：
```bash
# 在 Ubuntu / WSL 环境中安装 squashfs-tools
sudo apt update && sudo apt install -y squashfs-tools
npm install --production
npx electron-builder --linux AppImage
```

配置与本地化 / Configuration & Localization

配置文件保存在应用存储（使用 `electron-store`），支持界面语言切换（多语言资源位于 `src/main/i18n/`）。

支持的邮件服务 / Supported providers

- 原生 IMAP/SMTP（自定义服务器）
- Microsoft Graph（使用 OAuth 登录，支持 Outlook/Office365）

贡献 / Contributing

欢迎提交 issue 与 PR。请在修改前创建 issue 讨论大改动。仓库使用 GPL-3.0 许可（见 LICENSE 文件）。

License / 许可

本项目遵循 GPL-3.0 许可，详见 LICENSE 文件。

作者 / Author

ASimpUsr

