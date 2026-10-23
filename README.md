# 小小薯 (XXS) 的用户脚本集合

一套 Tampermonkey / Violentmonkey 用户脚本，覆盖内容屏蔽、搜索效率、文本处理与内容剪藏。

- 仓库：https://github.com/lijkop/xxs-userscript-engineer
- Greasy Fork：https://greasyfork.org/zh-CN/users/995681-xxs-zyfx

## 脚本一览

每个脚本的详细说明（功能、使用方法、配置说明、更新日志）见 `docs/` 下的同名文档。

| 脚本 | 作用 | 运行站点 | 版本 |
|---|---|---|---|
| [小黑盒弹窗自动关闭](scripts/heybox-popup-dismiss.user.js) | 自动点掉小黑盒的“取消”弹窗 | xiaoheihe.cn | 1.0.2 |
| [小黑盒内容净化器](scripts/heybox-content-purifier.user.js) | 帖子与评论区的关键词 / 分区 / 零互动过滤 | xiaoheihe.cn | 4.1.2 |
| [小黑盒收藏夹整理器](scripts/heybox-favour-organizer.user.js) | 批量抓取收藏帖正文与评论，每条存一个 MD 并打包成 ZIP | xiaoheihe.cn | 1.0.0 |
| [Linux.do 内容过滤器](scripts/linuxdo-content-filter.user.js) | 关键词过滤标签、标题、正文与评论 | linux.do | 1.0.1 |
| [Reddit 内容屏蔽器](scripts/reddit-content-blocker.user.js) | 按关键词、用户名屏蔽帖子与评论 | reddit.com | 1.0.2 |
| [V2EX 关键词屏蔽器](scripts/v2ex-keyword-blocker.user.js) | 三组关键词隐藏帖子与评论 | v2ex.com | 1.0.1 |
| [X (Twitter) 内容屏蔽器](scripts/twitter-content-blocker.user.js) | 关键词 / 用户名 / 零互动屏蔽推文与回复 | x.com、twitter.com | 2.1.2 |
| [Xtract（X 内容采集）](scripts/xtract.user.js) | 抓主页帖子 / 转帖用户 / 引用推文，可复制正文+评论并导出 | x.com、twitter.com | 1.3.0 |
| [微博内容屏蔽器](scripts/weibo-content-blocker.user.js) | 关键词屏蔽，支持超话与蓝 V 规则 | weibo.com | 3.4.1 |
| [小红书关键词屏蔽器](scripts/xhs-keyword-blocker.user.js) | 关键词屏蔽，支持隐藏与模糊两种模式 | xiaohongshu.com | 1.0.1 |
| [小红书评论批量复制](scripts/xhs-comment-copier.user.js) | 一键提取笔记评论到剪贴板 | xiaohongshu.com | 1.1.2 |
| [豆瓣小组关键词屏蔽器](scripts/douban-group-keyword-blocker.user.js) | 屏蔽命中的小组帖子 | douban.com/group | 1.0.2 |
| [即刻内容屏蔽器](scripts/jike-content-blocker.user.js) | 关键词屏蔽时间线，支持已读隐藏 | web.okjike.com | 3.2.1 |
| [即刻分区快捷面板](scripts/jike-channel-panel.user.js) | 常驻悬浮面板，快速跳转自定义分区 | web.okjike.com | 0.3.1 |
| [知乎回答剪藏](scripts/zhihu-answer-clipper.user.js) | 提取回答正文复制到剪贴板 | zhihu.com | 1.6.2 |
| [知乎自动展开全部回答](scripts/zhihu-auto-expand-answers.user.js) | 自动点击“查看全部回答” | zhihu.com | 1.0.1 |
| [多引擎批量搜索](scripts/multi-engine-search.user.js) | 一键在多个搜索引擎打开同一关键词 | 全站 | 2.1.2 |
| [网页正文一键提取](scripts/web-article-extractor.user.js) | 快捷键提取清洗网页正文到剪贴板 | 全站 | 1.0.1 |
| [全网文本替换器](scripts/global-text-replacer.user.js) | 自定义规则替换网页文本，适配 React/Vue | 全站 | 1.4.1 |
| [创作者跨平台管理面板](scripts/creator-platform-panel.user.js) | 常驻导航面板，平台与标签管理 | 全站 | 2.0.1 |

## 安装

1. 先装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)；
2. 推荐在 Greasy Fork 搜索脚本名安装，能自动更新；
3. 也可以打开 `scripts/` 目录下对应的 `.user.js` 文件，点右上角 **Raw** 安装。

## 更新

脚本内的 `@updateURL` 指向本仓库，Tampermonkey 会自动检查更新（默认每 24 小时一次）。
手动检查：Tampermonkey 面板 → 实用工具 → 检查更新脚本。

> GitHub raw 有约 5 分钟的 CDN 缓存，刚发布后立刻检查更新可能仍拿到旧版本，稍等再试即可。

## 目录结构

```text
scripts/                  # 用户脚本，每个脚本独立维护版本号
docs/                     # 每个脚本对应的详细说明（Greasy Fork 附加信息同步此文件）
.github/workflows/        # 推送时校验脚本元数据与文档版本一致性
```

## 版本规范

语义化版本 `主版本.次版本.修订号`：新增功能加次版本，修问题加修订号。

## 反馈

脚本失效（通常是目标站点改版导致选择器变化）请提 [Issue](https://github.com/lijkop/xxs-userscript-engineer/issues)，附上页面地址、浏览器版本和 F12 Console 里的报错信息，能大幅加快修复。
