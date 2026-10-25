# B站评论批量导出

> 版本：1.0.3 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

一键抓取 B 站视频 / 番剧 / 动态 / 专栏的评论区，导出为 Markdown、JSON、CSV。

B 站评论区是 Lit Web Components，评论内容全部在 Shadow DOM 里，`document.querySelector` 和「另存网页源码」都取不到。本脚本递归穿透 shadowRoot 读取真实节点，翻页后重复抓取会自动去重累积。

## 功能

- 穿透 Shadow DOM 读取楼层（`bili-comment-thread-renderer`）里的评论文本、用户名、主页、时间、点赞数、IP 属地
- 楼中楼（`bili-comment-reply-renderer`）单独解析，导出时挂在对应主楼下方做缩进
- **自动展开楼中楼**：B 站默认只渲染前 2 条回复，脚本会先点「共 N 条回复，点击查看」再采集
- UP 主识别：按昵称的内联色 `#FB7299` 判定，导出时标「UP主」
- 正文还原：换行（`<br>`）、B 站表情（按 `alt` 还原成 `[笑哭]` 这类文本）、话题/搜索链接、评论附图（收集为 Markdown 图片链接）
- 三种导出：Markdown（带元信息头、按楼层编号）、JSON（全字段）、CSV（带 BOM，Excel 不乱码）
- 复制：Markdown 直接进剪贴板
- 自动滚动采集：滚到底部触发加载，连续 4 轮无新增自动停止，滚动间隔带 ±25% 随机抖动
- 手动模式：不自动滚，持续轮询收集（约 700ms 一次），适合手动翻页时使用
- **面板每次打开页面都自动收起**，只留右下角一个 40px 圆点，不挡内容
- 抓取中圆点变成 `● 抓取中 N` 小胶囊，点一下即暂停
- `Esc` 暂停（暂停后自动展开面板方便导出），`Alt+X` 唤出/收起，面板可拖动
- 换页面（SPA 路由变化）自动清空数据，避免上一稿串到下一稿
- 结构快照：一键下载带 `<template shadowrootmode>` 的完整 DOM，供排查选择器

## 使用方法

1. 安装脚本后打开任意 B 站视频页，页面右下角会出现蓝色圆点（面板默认收起）
2. 点圆点展开面板 → 点「抓取当前评论」
3. 需要全部评论时点「自动滚动」，脚本会边滚边收；到底后自动停止并展开面板
4. 点「导出 MD」下载，或点「复制」直接粘进笔记

## 配置说明

无需配置。面板每次打开页面都自动收起，点圆点或按 `Alt+X` 展开。

评论数据不做持久化，刷新页面即清空。

## 兼容网站

- `https://*.bilibili.com/video/*`
- `https://*.bilibili.com/bangumi/play/*`
- `https://*.bilibili.com/opus/*`
- `https://*.bilibili.com/read/*`

## 更新日志

### 1.0.3

- **面板改为每次打开页面默认收起**，只留右下角圆点；不再持久化展开状态，避免一进页面就弹出悬浮面板
- 精简 `@grant`：移除未使用的 `GM_getValue` / `GM_setValue` / `GM_notification`

### 1.0.2

- 标题下的一行描述只保留功能说明，反馈渠道不再挤在里面，统一放到本页「反馈」区块

### 1.0.1

- 按真实运行时 DOM 核对全部选择器，去掉 1.0.0 的推定路径
- 修复：楼中楼外层没有 `bili-comment-renderer`，原实现会整条丢失
- 修复：时间 `#pubdate`、点赞 `#like #count` 实际在 `bili-comment-action-buttons-renderer` 的 shadowRoot 里，不在评论 renderer 里
- 修复：表情图误判为评论配图（按 `bfs/emote` 与 `alt` 格式判断）
- 新增：IP 属地字段
- 新增：自动展开「共 N 条回复，点击查看」
- 新增：UP 主识别（昵称内联色 `#FB7299`）

### 1.0.0

- 首个版本：Shadow DOM 穿透采集、楼中楼、MD/JSON/CSV 导出、自动滚动、结构快照诊断

## 反馈

反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
