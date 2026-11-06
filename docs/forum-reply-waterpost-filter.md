# 论坛回复水帖过滤器

> 版本：1.0.0 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

在 Linux.do 与 V2EX 的主题详情页隐藏命中关键词的回复。两站使用同一份屏蔽词配置。

## 功能

- 过滤回复正文；不检查主帖、标题或列表项。
- 默认忽略引用块、`pre` 与 `code` 内容。
- 使用 MutationObserver 处理动态加载和更新的回复。
- 关键词经 NFKC 与小写规范化后按子串匹配。
- Linux.do 的 post number 1 是主帖，不作为回复处理。

## 默认关键词

`多谢`、`节日快乐`、`待我尝尝鲜`、`谢谢`、`有用，`、`有用！`、`感谢`、`感谢佬`、`神了佬`、`牛逼`

## 使用方法

1. 在 Tampermonkey 中安装这份脚本；同一脚本会自动匹配两个站点。
2. 点击油猴菜单「编辑共享回复屏蔽词」维护列表，每行一个，也可用英文逗号或分号分隔。
3. 配置写入同一份 GM 存储；另一站已打开的页面重新加载后读取最新列表。

既有 Linux.do 内容过滤器和 V2EX 关键词屏蔽器仍可单独使用；如果它们已设置回复关键词，旧规则也会继续生效。只想使用共享列表时，请在旧脚本中清空或关闭回复关键词过滤。

## 兼容网站与选择器

- `https://linux.do/*`、`https://*.linux.do/*`
  - 已在真实帖子详情页确认 `.topic-post[data-post-number]` 中包含回复，正文可由 `.post__contents .cooked`、`.topic-body .cooked` 或 `.cooked` 找到。
- `https://www.v2ex.com/*`、`https://v2ex.com/*`、`https://*.v2ex.com/*`
  - 已在真实帖子详情页确认 `.reply_content` 是回复正文，最近的 `.cell` 是整条回复容器。

实测日期：2026-11-06。站点更新后仍需复核选择器。

## 配置说明

- GM 存储键：`forum-reply-waterpost-filter:keywords:v1`；关键词只保存在此脚本自己的 GM 存储中，不上传。
- 两个域名共用同一脚本及存储键；其他独立脚本的 GM 数据不会自动合并。
- 新增论坛时，在脚本 `adapters` 中添加域名匹配、回复根节点和正文选择器。

## 更新日志

### 1.0.0

- 首个版本：Linux.do 与 V2EX 共用一份回复屏蔽词配置。
- 添加忽略引用与代码块的处理。

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer
