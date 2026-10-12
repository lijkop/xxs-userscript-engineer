# Greasy Fork 建站填单表

用途：在 Greasy Fork 逐个新建脚本页面时，直接复制本表内容，避免重复劳动。
前提：每个脚本页面**首次必须手动创建**，之后才能靠同步/Webhook 更新。

## 通用设置（每个脚本都一样）

- 语言：**JavaScript**
- 源码方式：**从外部源码同步**（Synchronize from external source）
- 许可：**暂不选择**（等统一确定后再设，见文末）
- 分类：「按性质就近选择」——下表给的是性质建议，具体选项名以 Greasy Fork 界面实际为准
- 脚本名称：与源码 `@name` 保持一致（下表第一列）

## 建议填入 Additional info 的通用模板

```markdown
## 简介
{把下表的「描述」粘到这里}

## 功能
- {按脚本实际功能列 2~5 条}

## 安装
1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey
2. 点击本页「安装此脚本」

## 更新
脚本源码托管在 GitHub，本页内容自动同步：
https://github.com/lijkop/xxs-userscript-engineer

## 反馈
有问题请提 Issue：https://github.com/lijkop/xxs-userscript-engineer/issues
```

## 18 个脚本填单

| # | 脚本名称 | 描述（粘到 Greasy Fork「描述」） | 性质 / 分类建议 | 源码地址（粘到「外部源码」） |
|---|---|---|---|---|
| 1 | 多引擎批量搜索 | 批量在多个搜索引擎同时打开当前关键词，支持引擎分组、快捷键录制、油猴菜单、悬浮按钮、拖拽排序与配置导入导出。 | 效率工具 / 搜索工具 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/multi-engine-search.user.js` ✅ 已发布 |
| 2 | 小黑盒弹窗自动关闭 | 自动点击小黑盒页面上的“取消”按钮，关闭干扰弹窗。 | 站点优化 / 网站外观 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/heybox-popup-dismiss.user.js` |
| 3 | 小黑盒内容净化器 | 小黑盒论坛内容过滤：按关键词、零赞零评、分区过滤帖子，并净化评论区（插眼、关键词、纯表情、楼中楼）。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/heybox-content-purifier.user.js` |
| 4 | Linux.do 内容过滤器 | 按关键词过滤 Linux.do 的标签、标题、主帖正文与评论回复。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/linuxdo-content-filter.user.js` |
| 5 | Reddit 内容屏蔽器 | 按关键词与用户名屏蔽 Reddit 帖子、评论和用户，支持规则导入导出与可视化面板。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/reddit-content-blocker.user.js` |
| 6 | V2EX 关键词屏蔽器 | 自定义三组关键词，隐藏 V2EX 中包含关键词的帖子标题、正文或评论。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/v2ex-keyword-blocker.user.js` |
| 7 | X (Twitter) 内容屏蔽器 | 按关键词、用户名与互动数（如零评论）隐藏 X/Twitter 上的推文与回复，隐藏后不残留空白。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/twitter-content-blocker.user.js` |
| 8 | 小红书关键词屏蔽器 | 小红书网页版关键词屏蔽工具，支持可视化面板、无限滚动适配、隐藏与模糊两种拦截模式、规则本地持久化。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/xhs-keyword-blocker.user.js` |
| 9 | 小红书评论批量复制 | 悬浮球触发，一键提取小红书笔记评论并复制到剪贴板，支持自动滚动加载。 | 效率工具 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/xhs-comment-copier.user.js` |
| 10 | 微博内容屏蔽器 | 按关键词屏蔽微博内容，支持悬浮窗管理、批量导入、屏蔽全部超话与蓝 V，隐藏后不占位。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/weibo-content-blocker.user.js` |
| 11 | 豆瓣小组关键词屏蔽器 | 屏蔽豆瓣小组中标签或标题命中关键词的帖子。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/douban-group-keyword-blocker.user.js` |
| 12 | 即刻内容屏蔽器 | 按关键词屏蔽即刻时间线内容，支持已读隐藏与去重处理。 | 内容过滤 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/jike-content-blocker.user.js` |
| 13 | 即刻分区快捷面板 | 在即刻网页版右下角添加常驻悬浮面板，用于收藏和快速跳转自定义分区。 | 效率工具 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/jike-channel-panel.user.js` |
| 14 | 知乎回答剪藏 | 提取知乎问题页的回答正文并复制到剪贴板，便于剪藏保存。 | 效率工具 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/zhihu-answer-clipper.user.js` |
| 15 | 知乎自动展开全部回答 | 自动点击知乎问答页的“查看全部回答”，不触发页面滚动。 | 站点优化 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/zhihu-auto-expand-answers.user.js` |
| 16 | 创作者跨平台管理面板 | 为跨平台创作者提供常驻导航面板，支持边缘吸附、平台与标签筛选、备注、数据导入导出。 | 效率工具 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/creator-platform-panel.user.js` |
| 17 | 全网文本替换器 | 按自定义规则在全网页面替换文本内容，适配 React/Vue 与虚拟列表，支持首次加载、动态变更与定时兜底。 | 效率工具 / 全站 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/global-text-replacer.user.js` |
| 18 | 网页正文一键提取 | 快捷键提取并清洗网页正文（保留链接文字、去除链接 URL）到剪贴板，带可视化快捷键设置面板。 | 效率工具 / 全站 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/web-article-extractor.user.js` |

## 发布顺序建议

1. 先发 5 个规则简单的（#2 小黑盒弹窗、#11 豆瓣、#14 知乎剪藏、#15 知乎自动展开、#13 即刻面板），走通流程
2. 再发内容过滤类（#3~#8、#10、#12）
3. 最后发 3 个全站脚本（#1、#17、#18）——`@match *://*/*` 可能被审核询问用途，`@description` 已写明是全站工具，照实回答即可

## 许可（待统一决定）

当前 18 个脚本里，5 个自带 `@license MIT`，13 个没有。建议统一为 MIT，并在仓库放 `LICENSE` 文件；确定后我会一次性补齐，同时也会在 Greasy Fork 页面把许可选上。
