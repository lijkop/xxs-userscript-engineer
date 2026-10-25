# B站评论批量导出

> 版本：1.0.1 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

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
- 面板可拖动；收起后只留 40px 圆点；抓取中变成 `● 抓取中 N` 小胶囊
- `Esc` 暂停（暂停后自动展开面板方便导出），`Alt+X` 唤出/收起
- 换页面（SPA 路由变化）自动清空数据，避免上一稿串到下一稿
- 结构快照：一键下载带 `<template shadowrootmode>` 的完整 DOM，供排查选择器

## 使用方法

1. 安装脚本后打开任意 B 站视频页，页面右下角会出现蓝色圆点
2. 点圆点展开面板 → 点「抓取当前评论」
3. 需要全部评论时点「自动滚动」，脚本会边滚边收；到底后自动停止并展开面板
4. 点「导出 MD」下载，或点「复制」直接粘进笔记

## 配置说明

存储键（`GM_setValue`）：

- `panelCollapsed`：面板是否收起，默认 `false`

评论数据不做持久化，刷新页面即清空。

## 兼容网站

- `https://*.bilibili.com/video/*`
- `https://*.bilibili.com/bangumi/play/*`
- `https://*.bilibili.com/opus/*`
- `https://*.bilibili.com/read/*`

## 更新日志

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

---

## 开发备注（内部，勿同步到 Greasy Fork）

**结构证据：2026-10-25 用户提供的真实运行时 DOM，逐层核对。**

```
bili-comments
  #shadow-root
    #contents
      #feed
        bili-comment-thread-renderer            ← 一层楼
          #shadow-root
            <bili-comment-renderer id="comment">            主楼
            #replies > bili-comment-replies-renderer
              #shadow-root
                #expander-contents
                  bili-comment-reply-renderer × N            楼中楼（默认 2 条）
                  #expander-footer #view-more bili-text-button   「共 N 条回复，点击查看」
```

取值路径（已核对，非推定）：

| 字段 | 路径 |
|---|---|
| 用户名 | `bili-comment-user-info`.shadowRoot → `#info #user-name a` |
| 主页 | 同上 `a[href]`（`//space.bilibili.com/<mid>`） |
| UP主 | 同上 `a` 的 inline `color:#FB7299` |
| 正文 | `bili-rich-text`.shadowRoot → `p#contents` |
| 时间 | `bili-comment-action-buttons-renderer`.shadowRoot → `#pubdate` |
| IP属地 | 同上 `#ip`（文本为 `IP属地：广西`） |
| 点赞 | 同上 `#like #count` |
| 楼中楼容器 | `bili-comment-replies-renderer`.shadowRoot → `bili-comment-reply-renderer` |

两个反直觉的点（1.0.0 都踩了）：

1. **楼中楼没有 `bili-comment-renderer` 包裹层**，直接是 `reply-renderer > #body > #main > user-info + rich-text`。
2. **时间和点赞数不在评论容器的 shadowRoot 里**，而在它内部的 `bili-comment-action-buttons-renderer` 的 shadowRoot 里，多下探一层。

尚未验证：翻页方式（滚到底自动加载 vs 分页按钮）、置顶标记的实际节点。这两项不影响正确性，翻页靠用户手动操作后重复点「抓取」也能累积。
