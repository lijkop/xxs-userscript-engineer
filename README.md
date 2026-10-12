# 小小薯 (XXS) 的用户脚本集合

> 作者：**小小薯 (XXS)** · 发布平台：GitHub + Greasy Fork
> 一套自用出发、逐步公开的用户脚本，覆盖内容屏蔽、搜索效率、文本处理与内容剪藏。

## ⚠️ 开始使用前请先看

- 脚本内已写入正式地址：`@homepage`、`@supportURL`、`@updateURL`、`@downloadURL` 均指向 `https://github.com/lijkop/xxs-userscript-engineer`；**`@namespace` 保持原值不动**，以免影响已安装的老用户。
- 本仓库脚本**尚未在浏览器实测**（仅完成静态分析与元数据规范化），首发前建议在目标站点逐个验证。
- 本次只调整了脚本**显示名**（去掉“终极版”“稳定去重版”等后缀）与描述，`@namespace` 未变，因此从 Greasy Fork 更新的老用户不会丢失本地规则。若某次更新后出现重复条目，导出配置后删除旧条目即可。

## 脚本一览

| 脚本 | 作用 | 运行站点 | 版本 |
|---|---|---|---|
| [小黑盒弹窗自动关闭](scripts/heybox-popup-dismiss.user.js) | 自动点掉小黑盒的“取消”弹窗 | xiaoheihe.cn | 1.0.0 |
| [Linux.do 内容过滤器](scripts/linuxdo-content-filter.user.js) | 关键词过滤标签/标题/正文/评论 | linux.do | 1.0.0 |
| [Reddit 内容屏蔽器](scripts/reddit-content-blocker.user.js) | 按关键词、用户名屏蔽帖子与评论 | reddit.com | 1.0.0 |
| [V2EX 关键词屏蔽器](scripts/v2ex-keyword-blocker.user.js) | 三组关键词隐藏帖子与评论 | v2ex.com | 1.0.0 |
| [X (Twitter) 内容屏蔽器](scripts/twitter-content-blocker.user.js) | 关键词/用户名/零互动屏蔽推文 | x.com、twitter.com | 2.1.0 |
| [小红书关键词屏蔽器](scripts/xhs-keyword-blocker.user.js) | 关键词屏蔽，支持隐藏/模糊两种模式 | xiaohongshu.com | 1.0.0 |
| [创作者跨平台管理面板](scripts/creator-platform-panel.user.js) | 常驻导航面板，平台/标签管理与导入导出 | 全站 | 2.0.0 |
| [豆瓣小组关键词屏蔽器](scripts/douban-group-keyword-blocker.user.js) | 屏蔽命中的小组帖子 | douban.com/group | 1.0.0 |
| [即刻内容屏蔽器](scripts/jike-content-blocker.user.js) | 关键词屏蔽时间线，支持已读隐藏 | web.okjike.com | 3.2.0 |
| [即刻分区快捷面板](scripts/jike-channel-panel.user.js) | 常驻悬浮面板，快速跳转自定义分区 | web.okjike.com | 0.3.0 |
| [全网文本替换器](scripts/global-text-replacer.user.js) | 自定义规则替换网页文本，适配 React/Vue | 全站 | 1.4.0 |
| [微博内容屏蔽器](scripts/weibo-content-blocker.user.js) | 关键词屏蔽，支持超话/蓝 V 批量规则 | weibo.com | 3.4.0 |
| [多引擎批量搜索](scripts/multi-engine-search.user.js) | 一键在多个搜索引擎打开同一关键词 | 全站 | 2.1.0 |
| [小黑盒内容净化器](scripts/heybox-content-purifier.user.js) | 帖子/评论区多维过滤 | xiaoheihe.cn | 4.1.0 |
| [小红书评论批量复制](scripts/xhs-comment-copier.user.js) | 一键提取评论到剪贴板，自动滚动 | xiaohongshu.com | 1.1.0 |
| [知乎回答剪藏](scripts/zhihu-answer-clipper.user.js) | 提取回答正文复制到剪贴板 | zhihu.com | 1.6.0 |
| [知乎自动展开全部回答](scripts/zhihu-auto-expand-answers.user.js) | 自动点击“查看全部回答” | zhihu.com | 1.0.0 |
| [网页正文一键提取](scripts/web-article-extractor.user.js) | 快捷键提取清洗正文到剪贴板 | 全站 | 1.0.0 |

## 安装方式

1. **从 GitHub 直接安装**（推荐开发版）：安装 Tampermonkey 后打开
   `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/<脚本名>.user.js`
2. **从 Greasy Fork 安装**（推荐日常使用，带自动更新）：搜索脚本名或访问脚本主页。
3. **本地安装**：把 `scripts/` 下的 `.user.js` 拖进浏览器即可。

## 更新机制

脚本内已配置 `@updateURL` / `@downloadURL` 指向本仓库的 raw 地址，因此 Tampermonkey 会**直接从 GitHub 检查更新**（默认每 24 小时一次，可在设置中改为“总是”）。

```text
本地改代码 → 提升 @version → git push
   ├─ Tampermonkey 向 GitHub raw 比对版本 → 自动更新
   └─ Greasy Fork 同步 GitHub 源码 → 生成新版本供安装
```

- 必须提升 `@version`，否则客户端不会认为有新版本。
- GitHub raw 存在约 5 分钟的 CDN 缓存：刚 push 完立刻在 Tampermonkey 里点「检查更新」，可能仍拿到旧版本，过几分钟再试即可（不是推送失败）。
- 详细说明与已知注意事项见 [PUBLISH-CHECKLIST.md](PUBLISH-CHECKLIST.md)。

## 目录结构

```text
xxs-userscript-engineer/
├─ scripts/                  # 对外发布的脚本（Greasy Fork 从这里同步）
│  ├─ heybox-popup-dismiss.user.js
│  └─ ...
├─ src/                      # （可选）拆分为多文件的开发版
├─ README.md
├─ LICENSE                   # 版权确认后再添加
├─ LICENSE-REVIEW.md         # 版权与原创性审查记录
├─ PUBLISH-CHECKLIST.md      # 发布检查清单
└─ scripts-manifest.csv      # 脚本全量登记表
```

## 版本规范

- 语义化版本 `主版本.次版本.修订号`；改功能加次版本，修问题加修订号。
- 每个脚本独立维护版本号，互不影响。
- 提交前必须手动修改 `@version`，否则同步不会生效。

## 许可

版权与原创性审查见 [LICENSE-REVIEW.md](LICENSE-REVIEW.md)。在全部脚本的版权确认完成前，仓库**不附带 LICENSE 文件**；已确认的脚本会单独标注 `@license`。

## 声明

本仓库脚本均**未完成浏览器实测**，仅通过静态检查（语法、权限、依赖、敏感信息、合规项）。若某个脚本在你使用时失效，欢迎提 Issue 并附上目标页面 URL。
