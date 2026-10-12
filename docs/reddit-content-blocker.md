# Reddit 内容屏蔽器

> 版本：1.0.2 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

按关键词与用户名屏蔽 Reddit 的帖子、评论和用户，配备可视化面板，规则支持导入导出。

## 功能

- 关键词屏蔽：标题、评论内容命中即隐藏
- 用户名屏蔽：指定 ID 的内容直接过滤
- 规则导入导出：通过剪贴板复制 / 粘贴规则数据
- 可视化面板管理规则，改动即时生效
- 使用 MutationObserver 处理动态加载的内容

## 使用方法

1. 安装后打开 reddit.com
2. 通过脚本面板添加关键词与要屏蔽的用户名
3. 需要迁移规则时，用面板中的导出 / 导入按钮（走剪贴板）

## 配置说明

- 配置存储键：`reddit_filter_data`
- 面板内维护关键词、用户名列表，支持导出 / 导入
- 数据保存在本地，不上传

## 兼容网站

- `https://reddit.com/*`
- `https://www.reddit.com/*`

## 更新日志

### 1.0.2
- 补齐中文描述与反馈渠道

### 1.0.1
- 修正域名匹配：增加 `reddit.com`（此前只有带 www 的地址）

### 1.0.0
- 首个正式版本

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer

