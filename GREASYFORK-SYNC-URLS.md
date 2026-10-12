# Greasy Fork 外部源码同步地址清单

仓库：`https://github.com/lijkop/xxs-userscript-engineer`（Public）
分支：`main`　目录：`scripts/`

在 Greasy Fork 的脚本编辑页选择「从外部源码同步 / Synchronize from external source」，把下表对应的地址粘进去。

| # | 脚本名 | 源码地址（粘贴这一列） |
|---|---|---|
| 1 | 小黑盒弹窗自动关闭 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/heybox-popup-dismiss.user.js` |
| 2 | 小黑盒内容净化器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/heybox-content-purifier.user.js` |
| 3 | Linux.do 内容过滤器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/linuxdo-content-filter.user.js` |
| 4 | Reddit 内容屏蔽器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/reddit-content-blocker.user.js` |
| 5 | V2EX 关键词屏蔽器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/v2ex-keyword-blocker.user.js` |
| 6 | X (Twitter) 内容屏蔽器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/twitter-content-blocker.user.js` |
| 7 | 小红书关键词屏蔽器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/xhs-keyword-blocker.user.js` |
| 8 | 小红书评论批量复制 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/xhs-comment-copier.user.js` |
| 9 | 微博内容屏蔽器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/weibo-content-blocker.user.js` |
| 10 | 豆瓣小组关键词屏蔽器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/douban-group-keyword-blocker.user.js` |
| 11 | 即刻内容屏蔽器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/jike-content-blocker.user.js` |
| 12 | 即刻分区快捷面板 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/jike-channel-panel.user.js` |
| 13 | 知乎回答剪藏 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/zhihu-answer-clipper.user.js` |
| 14 | 知乎自动展开全部回答 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/zhihu-auto-expand-answers.user.js` |
| 15 | 创作者跨平台管理面板 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/creator-platform-panel.user.js` |
| 16 | 多引擎批量搜索 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/multi-engine-search.user.js` |
| 17 | 全网文本替换器 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/global-text-replacer.user.js` |
| 18 | 网页正文一键提取 | `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/web-article-extractor.user.js` |

## 说明

- 脚本内**已经写好** `@updateURL` / `@downloadURL`，指向的正是上面这些地址，Tampermonkey 装好后会直接从 GitHub 检查更新。
- Greasy Fork 保存外部源码时可能追加它自己的更新地址。若发现更新来源不确定，用 `多引擎批量搜索` 先做一次实测：把版本号改成 `2.1.1` → push → 看 Tampermonkey 拉到的是哪一版。
- 新建脚本页面时建议把「脚本名」填成和表格里一致的中文名，「描述」直接用脚本自带的中文 `@description`。
