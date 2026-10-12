# 发布检查清单（Greasy Fork + GitHub）

状态：**等待你确认后才可公开发布**。本清单不包含任何已执行的发布动作。

---

## 一、发布前必须先做的 4 件事

1. **地址已写入，无需再改**
   18 个脚本的 `@homepage`、`@supportURL`、`@updateURL`、`@downloadURL` 已全部指向 `https://github.com/lijkop/xxs-userscript-engineer`；**`@namespace` 保持原值不动**（保护已安装的老用户）。
   剩下要做的只有两件事：在 GitHub 建好名为 `xxs-userscript-engineer` 的 **Public** 空仓库（不要勾选 README / .gitignore），然后推送本地首次提交。
2. **确认老用户的更新路径**
   本次只改了脚本**显示名**与描述，`@namespace` 未变。从 Greasy Fork 更新时，Tampermonkey 按下载地址匹配，本地规则保留；建议先在一台测试机验证一次“旧版 → 新版”的更新，确认没有产生重复条目，再发给用户。
3. **浏览器实测**（当前**未做**任何实测）
4. **版权确认**：已完成，18 个脚本均为本人原创，无第三方代码

---

## 二、A. 可直接提交审核（18 个，全部）

| 脚本 | 备注 |
|---|---|
| heybox-popup-dismiss.user.js | |
| heybox-content-purifier.user.js | 署名已确认为本人，自带 MIT |
| linuxdo-content-filter.user.js | 建议先实测面板性能 |
| reddit-content-blocker.user.js | |
| v2ex-keyword-blocker.user.js | |
| twitter-content-blocker.user.js | 自带 MIT |
| xhs-keyword-blocker.user.js | |
| creator-platform-panel.user.js | 全站匹配，审核可能被问用途 |
| douban-group-keyword-blocker.user.js | |
| jike-content-blocker.user.js | |
| jike-channel-panel.user.js | |
| global-text-replacer.user.js | 全站匹配 + setInterval，建议说明 |
| weibo-content-blocker.user.js | |
| multi-engine-search.user.js | 3124 行，重点实测 |
| xhs-comment-copier.user.js | 自带 MIT |
| zhihu-answer-clipper.user.js | 原“复制版”标记已确认与第三方无关 |
| zhihu-auto-expand-answers.user.js | 选择器可能随知乎改版失效 |
| web-article-extractor.user.js | 自带 MIT，全站匹配 |

## 三、B. 需确认版权后再发

**已清空。** 18 个脚本均由作者本人确认原创（`kun`、`zhuf` 为本人化名；知乎剪藏与第三方脚本无关），可全部进入 A 组发布流程。

## 四、C. 需要浏览器实测（全部 18 个，以下为重点）

| 优先级 | 脚本 | 原因 |
|---|---|---|
| 高 | multi-engine-search | 3124 行，跨站行为最复杂 |
| 高 | linuxdo-content-filter | 1878 行，且 `document-start` 注入 |
| 高 | weibo-content-blocker / xhs-keyword-blocker | 屏蔽规则最多，易受页面改版影响 |
| 中 | 4 个全站匹配脚本 | 需确认不会误伤普通站点 |
| 中 | global-text-replacer | 含定时兜底，需确认性能 |
| 低 | 其余小脚本 | 逻辑简单，点开页面验证即可 |

**当前状态：仅完成静态分析，未进行浏览器实测。** 不要对外宣称“已测试通过”。

## 五、D. 不建议公开发布

当前无。若后续某个脚本被发现含他人代码且未获授权，移入本组，仅自用。

---

## 六、GitHub 仓库结构（一个仓库管多个脚本）

```text
xxs-userscript-engineer/
├─ scripts/                       # 对外发布目录，Greasy Fork 从这里同步
│  ├─ heybox-popup-dismiss.user.js
│  └─ ... （每脚本独立 @version）
├─ src/                           # 可选：需要拆分多文件时的开发版
├─ README.md
├─ LICENSE                        # 版权确认后添加
├─ LICENSE-REVIEW.md
├─ PUBLISH-CHECKLIST.md
├─ scripts-manifest.csv
└─ .github/
   └─ workflows/validate.yml      # 可选：提交时校验元数据
```

原则：
- 每个脚本独立版本号，互不影响；
- `scripts/` 只放可直接安装的版本，**不放压缩版/混淆版**（Greasy Fork 要求源码可读）；
- 改代码必须改 `@version`，否则 Greasy Fork 不会发布新版本。

## 七、GitHub Raw 地址模板

```text
https://raw.githubusercontent.com/{USER}/{REPO}/main/scripts/{SLUG}.user.js
```

示例：

```text
https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/weibo-content-blocker.user.js
```

国内访问更快的 CDN 备选（内容相同，缓存最长 24 小时）：

```text
https://cdn.jsdelivr.net/gh/{USER}/{REPO}@main/scripts/{SLUG}.user.js
```

18 个脚本的 `{SLUG}` 见 `scripts-manifest.csv` 的“输出文件名”列。

## 八、Greasy Fork 外部源码同步配置

### 首次发布（每个脚本都要手动做一次）

1. 登录 Greasy Fork → 用户 → **创建脚本**；
2. 语言选 JavaScript，粘贴方式选“**从外部源码同步**”（Synchronize from external source）；
3. 源码 URL 填上面的 GitHub Raw 地址；
4. 补充脚本的说明（Additional info，支持 Markdown）、分类、适用站点；
5. 保存。之后 Greasy Fork 会定期拉取该 URL。

> 注意：Greasy Fork 的脚本页面**必须先手动创建**，Webhook 只能触发已存在页面的同步，不能自动创建新脚本。

> 已知冲突点：设置外部源码同步后，Greasy Fork 会在它托管的副本里追加自己的 `@updateURL` / `@downloadURL`，而源码中已带 GitHub 的地址，可能出现两个更新源。建议先用一个脚本实测（改版本号 → push → 观察 Tampermonkey 拉到的是 GitHub 版本还是 GF 版本），确认更新路径后再批量配置。

> 已知缓存现象（实测于 2026-10-13）：`raw.githubusercontent.com/<user>/<repo>/main/...` 这个短路径有约 5 分钟的 CDN 缓存，push 完成后立刻访问仍会返回旧内容，容易误判为推送失败。排查时改用 `https://raw.githubusercontent.com/<user>/<repo>/refs/heads/main/...` 形式即可读到最新内容；正常更新场景等待几分钟即可，无需改动脚本里的地址。

### 同步的触发条件

- **自动**：Greasy Fork 会定期（约每日）检查外部源码；
- **手动**：脚本页面 → 管理 → 立即同步；
- **Webhook**：push 后立刻触发（推荐，见下节）；
- **前提**：`@version` 必须比线上版本大，否则不会生成新版本。

## 九、GitHub Webhook（推荐，配一次全部生效）

Greasy Fork 提供的是**账号级** Webhook——**整个仓库只配一个**，不需要每个脚本配一遍。

Payload URL（来自 Greasy Fork 账号设置页）：

```text
https://api.greasyfork.org/zh-CN/users/995681-xxs-zyfx/webhook
```

配置步骤：

1. GitHub 仓库 → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL**：填上面的地址
3. **Content type**：`application/json`
4. **Secret**：留空
5. 事件：选 **Just the push event**（若只想在发版时更新，选 Let me select individual events，勾掉 Pushes、勾上 Releases）
6. **Active** 打勾 → Add webhook

工作原理：push 时 GitHub 通知 Greasy Fork，GF 读取该事件中**被修改的文件**，对照已在 GF 上设置了「外部源码同步」的脚本，拉取更新。仍然要求 `@version` 变大才会生成新版本。

注意事项：

- 触发过一次之后，GF 脚本页面的同步类型才会从「自动 / 手动」变成 Webhook 同步。
- 只有 push 事件里**包含该脚本文件**时才会同步对应脚本。
- 前置条件：脚本已在 GF 上设为「从外部源码同步」。
- 该地址请以 Greasy Fork 用户设置页显示为准。

### 备用方案：GitHub Actions（可选）

仓库里已带 `.github/workflows/sync-greasyfork.yml`：push 时自动校验脚本元数据（缺 `@name`/`@version`/`@description`/`@match` 会报错）。若再配置仓库 Secret `GF_SYNC_URLS`（多个同步地址用空格分隔），它还能兜底触发同步。有了账号级 Webhook 之后，这一步不是必需的。

## 十、当前进度与后续顺序

已完成：

1. ✅ 仓库建立并推送：`lijkop/xxs-userscript-engineer`
2. ✅ 版权确认：18 个脚本均为本人原创（`kun`、`zhuf` 为本人化名）
3. ✅ 更新链路实测通过：GitHub → Tampermonkey（多引擎批量搜索 `2.1.0` → `2.1.1`）
4. ✅ Greasy Fork 已设置外部源码同步 4 个：多引擎批量搜索、小黑盒内容净化器、小黑盒弹窗自动关闭、X (Twitter) 内容屏蔽器
5. ✅ 2026-10-13 修正 7 个脚本的域名匹配问题（见第十一节）

待办：

1. 配置仓库级 Webhook（第九节，配一次全部生效）
2. Greasy Fork 上创建剩余 14 个脚本页面（用 `GREASYFORK-SUBMIT-SHEET.md`）
3. 浏览器实测 18 个脚本，重点：多引擎批量搜索、Linux.do 内容过滤器、微博内容屏蔽器、小红书关键词屏蔽器；小黑盒两个脚本还需确认真实页面类名（见 `TROUBLESHOOTING.md`）
4. 决定是否统一 `@license MIT` 并添加 `LICENSE` 文件

---

## 附：本次已做的规范化改动（仅元数据，代码逻辑未动）

| 项目 | 改动 |
|---|---|
| `@author` | 统一为 `小小薯 (XXS)`，覆盖 You / Your Name / Gemini / Assistant / Architect_Pro / 油猴脚本创建专家 / 空值 |
| `@name` | 去掉 emoji、版本号后缀、营销词（终极版 / 净网架构师 / 无缝隐形版 / 稳定去重版 / 常驻打开版 / 复制版），统一为“功能名”格式 |
| `@name:en` | 全部新增英文名 |
| `@description` / `@description:en` | 重写为准确、简洁的中英文描述，去掉夸大表述 |
| `@namespace` | **保持不变**（沿用原值 `tampermonkey.net`、`linux.do`、`heybox.com`、`github.com/yourname` 等），避免已安装用户被识别为新脚本而丢失本地规则 |
| `@version` | 统一为三段式（1.0 → 1.0.0、3.2 → 3.2.0 等），只补零不倒退 |
| `@homepage` / `@supportURL` | 全部新增（仓库地址 / Issues 地址） |
| `@icon` | 删除 3 处引用站点 favicon 的图标 |
| `@match` | 智能正文助手的两条 http/https 合并为 `*://*/*`；2026-10-13 修正 7 处域名覆盖问题（见第十一节） |
| `@grant` | 与代码实际调用一一核对，无多余权限，未删除任何所需权限（已修正多引擎搜索的重复项） |
| `@license` | 仅保留原本已声明 MIT 的 5 个，其余待统一决定 |
| `@updateURL` / `@downloadURL` | 指向 GitHub raw，让 Tampermonkey 直接向仓库检查更新 |
| 代码主体 | **一字未改**（自动替换元数据块，行数差异仅来自元数据块变化） |

---

## 十一、域名覆盖修正记录（2026-10-13）

起因：小黑盒脚本"完全不工作"，排查发现 `xiaoheihe.cn` 与 `www.xiaoheihe.cn` 是两个独立解析的域名（实测都不跳转、都返回 200），而脚本只匹配了 `www` 版本 → 脚本从未注入。

据此对全部 18 个脚本做了同类排查，修正 7 处：

| 脚本 | 修正前 | 修正后 | 版本 |
|---|---|---|---|
| 小黑盒弹窗自动关闭 | `https://www.xiaoheihe.cn/*` | `https://*.xiaoheihe.cn/*` | 1.0.1 |
| 小黑盒内容净化器 | `https://www.xiaoheihe.cn/app/bbs/*` | `https://*.xiaoheihe.cn/app/bbs/*` | 4.1.1 |
| Reddit 内容屏蔽器 | 仅 `www.reddit.com` | 增加 `https://reddit.com/*` | 1.0.1 |
| X (Twitter) 内容屏蔽器 | `twitter.com` / `x.com` | `*://*.twitter.com/*` / `*://*.x.com/*` | 2.1.1 |
| 豆瓣小组关键词屏蔽器 | 仅 `www.douban.com` | 增加 `https://douban.com/group/*` | 1.0.1 |
| 知乎回答剪藏 | 仅 `www.zhihu.com/question/*` | `*://*.zhihu.com/question/*` | 1.6.1 |
| 小红书评论批量复制 | 仅 `www.xiaohongshu.com/...` | `*://*.xiaohongshu.com/...` | 1.1.1 |

不需要改动的：Linux.do（原本就带 `https://*.linux.do/*`）、V2EX（两条都写了）、微博（`https://*.weibo.com/*`）、小红书关键词屏蔽器（`*://*.xiaohongshu.com/*`）、即刻两个、知乎自动展开（`*://*.zhihu.com/...`）、以及 4 个全站脚本（`*://*/*`）。

⚠️ 尚未验证的部分：小黑盒页面是 JS 渲染的 SPA，静态抓取拿不到类名，脚本内的选择器（`a.hb-cpt__bbs-content` 等）**未经真机验证**。若修完域名后仍不生效，请按 `TROUBLESHOOTING.md` 第二节跑诊断代码，把实际类名发我。
