# V2EX 关键词屏蔽器

> 版本：1.0.1 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

自由管理三组关键词，分别作用于帖子标题、正文与评论，命中即隐藏。

## 功能

- 三组关键词独立配置，互不干扰
- 覆盖首页列表、节点页、帖子详情与评论区
- 在 `document-start` 阶段注入，列表渲染前完成过滤
- MutationObserver 跟踪动态加载内容

## 使用方法

1. 安装后打开 v2ex.com
2. 点击油猴菜单「关键词面板」打开配置面板
3. 在三组输入框中分别维护关键词，配置即时生效

## 配置说明

- 配置保存在本地存储（含初始化标记键）
- 面板内可随时增删关键词，不需要重新加载页面

## 兼容网站

- `https://www.v2ex.com/*`
- `https://v2ex.com/*`

## 更新日志

### 1.0.1
- 补齐中文描述与反馈渠道

### 1.0.0
- 首个正式版本：标题 / 正文 / 评论三组关键词

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer

