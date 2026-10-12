# 手动操作清单

这些步骤需要浏览器里的 GitHub / Greasy Fork 账号权限，脚本或命令行替代不了，照着做即可。

## 1. GitHub 仓库描述与 Topics

位置：仓库首页 → 右侧 **About** → 齿轮图标 → 编辑

**Description**（整行粘贴）：

```text
小小薯 (XXS) 的 Tampermonkey 用户脚本集合：内容屏蔽 · 搜索效率 · 文本处理，通过 Greasy Fork 同步发布。
```

**Website**（可选）：

```text
https://greasyfork.org/zh-CN/users/995681-xxs-zyfx
```

**Topics**（一个个添加；GitHub 只接受小写英文、数字、连字符）：

```text
userscript
userscripts
tampermonkey
violentmonkey
greasyfork
content-blocker
keyword-filter
productivity
```

## 2. 在 Greasy Fork 创建脚本页面（以 Linux.do 为例）

1. 登录 Greasy Fork → 右上角用户名 → **创建脚本**（也可以直接访问 `https://greasyfork.org/zh-CN/scripts/new`）
2. 语言：**JavaScript**
3. 源码方式：**从外部源码同步**（Synchronize from external source）
4. 源码 URL 粘这一条：
   `https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/linuxdo-content-filter.user.js`
5. 脚本名称填：`Linux.do 内容过滤器`
6. 描述填：`按关键词过滤 Linux.do 的标签、标题、主帖正文与评论回复。`
7. 保存。GF 会立刻拉取源码并解析元数据，页面上能看到 `@match`、版本等信息。
8. 完成 —— 之后这个脚本就被 Webhook 覆盖（若已配置），否则进入每日自动轮询。

剩下 17 个脚本是**完全一样的操作**，名称 / 描述 / 源码 URL 都在 `GREASYFORK-SUBMIT-SHEET.md` 的表格里，逐行复制即可。

> 提示：GF 展示的脚本名与描述以源码里的 `@name` / `@description` 为准，所以页面填的内容只要和源码一致就不会有出入。

## 3. 建议的发布顺序

**第一批（5 个，规则简单，先把流程走顺）**

1. 小黑盒弹窗自动关闭
2. 豆瓣小组关键词屏蔽器
3. 知乎回答剪藏
4. 知乎自动展开全部回答
5. 即刻分区快捷面板

**第二批（8 个，内容过滤主力）**

1. Linux.do 内容过滤器 ← 你现在要建的
2. V2EX 关键词屏蔽器
3. 即刻内容屏蔽器
4. 小红书关键词屏蔽器
5. 微博内容屏蔽器
6. Reddit 内容屏蔽器
7. 👉 已建：小黑盒内容净化器、X (Twitter) 内容屏蔽器

**第三批（4 个，全站类，审核可能问用途，照实答"全站生效工具"即可）**

1. 全网文本替换器
2. 网页正文一键提取
3. 创作者跨平台管理面板
4. 👉 已建：多引擎批量搜索

## 4. 仓库 Webhook（配置一次，全部生效）

位置：仓库 → **Settings** → **Webhooks** → **Add webhook**

| 字段 | 值 |
|---|---|
| Payload URL | `https://api.greasyfork.org/zh-CN/users/995681-xxs-zyfx/webhook` |
| Content type | `application/json` |
| Secret | 留空 |
| 事件 | **Just the push event** |
| Active | 勾选 |

详见 `PUBLISH-CHECKLIST.md` 第九节。

## 5. 为什么这些我不能代劳

- **仓库 Description / Topics**：属于 GitHub 仓库设置，需要带 `repo` 权限的 API token。本机只有 GitHub Desktop 的登录凭证，不能导出用于 API 调用（这是 GitHub 的设计）。
- **Greasy Fork 创建脚本**：Greasy Fork 没有开放创建脚本的 API，只能网页操作。
- **Webhook**：同上，需要仓库 Settings 权限。

如果你愿意提供一个只勾选 `repo` 权限的 GitHub Personal Access Token，我可以用 API 立刻把 Description 和 Topics 设置好；但 token 会出现在对话里，安全性由你权衡，我个人更建议你手动点两下。
