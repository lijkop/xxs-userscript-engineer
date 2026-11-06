# 论坛内容过滤器

> 版本：1.0.0 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

把 Linux.do 内容过滤器、Reddit 内容屏蔽器、论坛回复水帖过滤器合并成一个脚本：一套面板管理三个站点，规则各自独立，回复水帖词三站共享。以后新增论坛只需要加一段站点适配器，不用再复制一整份脚本。

## 功能

- **单一面板**：右下角「过滤设置」按钮打开，按站点折叠分区；保存后立即生效，不需要刷新页面。按钮上会显示当前已隐藏的条数。
- **Linux.do**
  - 按标签隐藏列表项（标签需完全一致）
  - 按关键词隐藏列表项的标题
  - 按关键词隐藏主帖（1 楼）正文
  - 按共享水帖词隐藏回复楼层（2 楼及以后）
- **V2EX**
  - 按共享水帖词隐藏回复（`.reply_content` 所在的楼层）
- **Reddit**
  - 按用户名隐藏帖子与评论
  - 按关键词隐藏帖子标题与评论正文
- **共享回复水帖词**：Linux.do 与 V2EX 共用一份词表，命中即隐藏回复；清空词表则不再过滤回复。
- **忽略引用与代码块**：默认开启。判断前先剔除引用块、代码块和选中工具栏，避免「引用里出现感谢」把正常回复误伤。可在面板里关掉。
- **规则导入导出**：面板「导入 / 导出」→ 输入 `E` 导出到剪贴板，或粘贴 JSON 导入；兼容旧版 Reddit 屏蔽器的 `{ users, keywords }` 格式。
- **动态页面适配**：`MutationObserver` 监听新增内容（无限滚动、SPA 切页），另加 1.5 秒兜底扫描与地址变化重扫，切帖后不会漏。
- **属性标记隐藏**：隐藏靠 `data-fcf-hidden="1"` 属性而不是 class，避免被 Discourse / Reddit 的框架重写类名后失效。

## 使用方法

1. 安装脚本后打开 linux.do、v2ex.com 或 reddit.com，页面右下角会出现「过滤设置」按钮。
2. 点开面板，在对应站点分区里填规则，每行一个；也可以在脚本管理器的菜单里点「打开过滤设置」。
3. 点「保存并应用」，命中项立刻隐藏；按 `Esc` 或点遮罩关闭面板。
4. 「恢复默认」会清空所有规则并恢复默认水帖词，操作前有确认框。

## 配置说明

配置保存在脚本存储键 `forum-content-filter:config:v1` 中，结构如下：

```json
{
  "enabled": true,
  "ignoreQuoteAndCode": true,
  "replyKeywords": ["多谢", "谢谢", "感谢"],
  "sites": {
    "linuxdo": { "enabled": true, "tags": [], "titleKeywords": [], "mainPostKeywords": [], "replyEnabled": true },
    "v2ex": { "enabled": true, "replyEnabled": true },
    "reddit": { "enabled": true, "keywords": [], "users": [] }
  }
}
```

- `enabled`：总开关；关掉后所有站点都不再隐藏，已有隐藏会恢复显示。
- 列表为空表示该维度不启用（相当于关闭这项过滤）。
- 站点分区的「启用」开关只影响该站点。
- **从旧脚本迁移**：用户脚本的存储按脚本隔离，旧脚本的配置不会自动带过来。在旧脚本面板里导出（或手动复制 JSON）后，用本脚本的「导入 / 导出」粘贴进来即可；旧 Reddit 屏蔽器的 `{ users, keywords }` 会被识别并写入 Reddit 分区。

## 兼容网站

- `https://linux.do/*`、`https://*.linux.do/*`
- `https://v2ex.com/*`、`https://www.v2ex.com/*`、`https://*.v2ex.com/*`
- `https://reddit.com/*`、`https://*.reddit.com/*`

> 本版本通过本地 DOM 夹具验证了隐藏逻辑与面板读写，**未在真实站点长期运行验证**。站点改版后如果选择器失效，请反馈。

## 新增论坛

脚本把「站点」抽象成适配器，新增一个论坛只要三步：

1. 在文件头加该站点的 `@match`（记得同时写 www 与非 www、子域）。
2. 在 `SITES` 数组里加一个适配器：`key`、`label`、`fields`（决定面板里显示哪些输入框）、`scan(root, siteConfig)`（找到目标节点并调用 `mark(节点, 原因)`，不需要隐藏时传空串）。
3. 在 `defaultConfig().sites` 和 `hasRules()` 里补上默认值与「有规则才扫描」的判断。

隐藏统一走 `data-fcf-hidden` 属性 + 脚本内置 CSS，适配器不需要自己写样式。

## 更新日志

### 1.0.0

- 合并原「Linux.do 内容过滤器」「Reddit 内容屏蔽器」「论坛回复水帖过滤器」三个脚本。
- 统一为单面板、单存储键，三站规则分区管理；回复水帖词由 Linux.do 与 V2EX 共享。
- 新增规则导入导出（兼容旧 Reddit 规则格式）、右下角隐藏计数、全局开关。
- 新增站点适配器结构，后续加论坛只加适配器。

## 反馈

- Telegram 频道：https://t.me/zzyyffxx
- GitHub Issues：https://github.com/lijkop/xxs-userscript-engineer/issues
