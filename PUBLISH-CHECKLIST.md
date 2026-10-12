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

### 同步的触发条件

- **自动**：Greasy Fork 会定期（约每日）检查外部源码；
- **手动**：脚本页面 → 管理 → 立即同步；
- **Webhook**：push 后立刻触发（推荐，见下节）；
- **前提**：`@version` 必须比线上版本大，否则不会生成新版本。

## 九、用 GitHub Webhook 触发 Greasy Fork 更新

1. Greasy Fork 脚本页面 → 管理 → 同步设置里会给出**该脚本专用的 Webhook URL**（形如 `https://greasyfork.org/scripts/<id>/sync` 带 token 参数）；
2. GitHub 仓库 → Settings → Webhooks → Add webhook：
   - Payload URL：Greasy Fork 给的 URL
   - Content type：`application/x-www-form-urlencoded`
   - Which events：**Just the push event**
   - 勾选 Active
3. 每个脚本一个 Webhook（因为 URL 按脚本 ID 区分）；
4. push 到 `main` 后，GitHub 会请求该 URL，Greasy Fork 拉取源码并比对 `@version`。

**等价替代**（不想配 18 个 Webhook 时）：用 GitHub Actions 在 push 时统一 curl 所有同步 URL。

```yaml
# .github/workflows/sync-greasyfork.yml
name: Sync to GreasyFork
on:
  push:
    branches: [main]
    paths: ['scripts/**']
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger GreasyFork sync
        run: |
          for url in "${{ secrets.GF_SYNC_URLS }}"; do
            curl -sS -X POST "$url" || echo "sync failed: $url"
          done
```

把 18 个同步 URL 以空格分隔存到仓库 Secret `GF_SYNC_URLS`，避免把 token 写进公开仓库。

## 十、发布顺序建议

1. 确定 GitHub 用户名 → 全局替换占位名 → 建仓库 → 首次 push；
2. 本地装一遍 `scripts/` 下的新脚本，逐个实测；
3. 确认 2 个版权待定脚本；
4. Greasy Fork 上逐脚本创建页面（先发 3~5 个简单的走通流程）；
5. 配 Webhook，验证 push 后自动同步；
6. 一次性配置好说明页、分类与截图，再批量发布剩余脚本。

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
| `@match` | 智能正文助手的两条 http/https 合并为 `*://*/*`；其余保持实际需要的站点 |
| `@grant` | 与代码实际调用一一核对，无多余权限，未删除任何所需权限（已修正多引擎搜索的重复项） |
| `@license` | 仅保留原本已声明 MIT 的 5 个，其余不擅自添加 |
| `@updateURL` / `@downloadURL` | 按约定不写入源码版本 |
| 代码主体 | **一字未改**（自动替换元数据块，行数差异仅来自元数据块变化） |
