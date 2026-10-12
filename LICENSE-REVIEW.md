# 版权与原创性审查记录

审查对象：`自建脚本备份` 中确认由本人（小小薯 / XXS）编写的 18 个脚本
审查方式：静态代码分析（未运行、未联网请求、未做浏览器实测）
审查日期：2026-10-13

## 一、总体结论

| 检查项 | 结果 |
|---|---|
| 是否引用第三方脚本源码（Greasy Fork / Sleazy Fork 链接） | **0 处** |
| 是否 `@require` / `@resource` 外部 CDN 依赖 | **0 处**（全部脚本无外部依赖） |
| 是否含第三方版权声明 | 仅 5 个脚本自带 `@license MIT`（本人此前添加） |
| 是否含混淆 / 压缩代码 | **否**，全部为可读源码 |
| 是否含 `eval` / `new Function` / `document.write` | **否** |
| 是否含网络请求（GM_xmlhttpRequest / fetch / XHR） | **否**（无数据外发） |
| 是否读取 Cookie / 硬编码 Token / API Key | **否** |
| 是否含个人信息（除作者署名） | **否** |

结论：**18 个脚本均为本人（小小薯 / XXS）独立实现的原创脚本，未发现第三方代码复制痕迹**，全部可进入发布流程。

## 二、署名与来源确认（已由作者本人确认）

### 1. `zhihu-answer-clipper.user.js`（知乎回答剪藏）

- 原文件名：`知乎精准剪藏 (v1.6 复制版).user.js`
- 原疑点：名称含“复制版”，疑似衍生自他人剪藏脚本。
- **作者已确认：本人原创，与第三方脚本无关。**
- 处理：已改名为“知乎回答剪藏”，名称中的“复制版”标记移除。

### 2. `heybox-content-purifier.user.js`（小黑盒内容净化器）

- 原作者字段：`架构师AI & kun & zhuf`
- 原疑点：`kun` 是否为他人。
- **作者已确认：`kun`、`zhuf` 均为本人（小小薯 / XXS）的化名。**
- 处理：`@author` 统一为 `小小薯 (XXS)`，不再保留化名署名。

## 三、许可证现状

| 脚本 | 原 `@license` | 现状 |
|---|---|---|
| twitter-content-blocker | MIT | 保留 `@license MIT` |
| global-text-replacer | MIT | 保留 `@license MIT` |
| heybox-content-purifier | MIT | 保留（署名已统一为小小薯 (XXS)） |
| xhs-comment-copier | MIT | 保留 `@license MIT` |
| web-article-extractor | MIT | 保留 `@license MIT` |
| 其余 13 个 | 无 | **未擅自添加**，待你确认后统一处理 |

### 建议（已具备执行条件）

- 18 个脚本都是本人原创（含 AI 辅助生成），因此**建议统一加 `@license MIT`**，并在仓库放 `LICENSE`（MIT 文本，Copyright 小小薯 (XXS)）。
- 执行时机：你确认后，我用一条命令给 13 个缺失 `@license` 的脚本补上，并同时生成 `LICENSE` 文件。
- 在你说“可以加”之前，仓库不附 `LICENSE`，脚本内也不写新的 `@license`。

## 四、合规自查（Greasy Fork 要求）

- 无 `@require` 外部资源 → 符合 GF 对外部依赖的要求。
- 无混淆代码 → 符合 GF“必须源码可读”要求。
- 无用户信息收集、无远程代码加载 → 符合隐私要求。
- 3 个脚本使用 `@match *://*/*`（创作者面板、全网文本替换器、网页正文提取、多引擎批量搜索，实际 4 个）：GF 允许全站匹配，但审核可能询问用途，`@description` 已写明是全站工具，可应对。
- 已移除 3 处引用站点 favicon 的 `@icon`（小红书关键词屏蔽器、即刻分区快捷面板、小黑盒内容净化器），避免引用第三方资源。

## 五、安全自查细节

- `innerHTML` 使用普遍（用于构建面板 UI），输入均为本地关键词规则，属于**自 XSS** 场景，风险可接受；若未来支持导入他人规则，需要先做转义。
- 全部脚本仅使用 `GM_getValue / GM_setValue / GM_addStyle / GM_registerMenuCommand / GM_setClipboard / GM_notification / GM_openInTab / GM_deleteValue`，**无跨域权限申请**，元数据中的 `@grant` 与代码实际调用一一对应，未发现多余权限。
- 未发现 `document.cookie`、localStorage 之外的持久化，数据均存于脚本自身沙箱内。
