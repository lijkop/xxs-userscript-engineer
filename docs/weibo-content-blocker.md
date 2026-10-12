# 微博内容屏蔽器

> 版本：3.4.1 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

按关键词屏蔽微博内容，支持悬浮窗管理、批量导入规则，可一键屏蔽超话与蓝 V。

## 功能

- 关键词屏蔽正文（支持批量导入）
- 屏蔽指定用户、内容来源
- 一键屏蔽全部超话、全部蓝 V
- 使用负边距隐藏，页面不出现空白断层
- 在 `document-start` 阶段注入，避免内容闪现

## 使用方法

1. 安装后打开 weibo.com
2. 油猴菜单提供三个入口：
   - 「📌 打开屏蔽悬浮窗」——管理关键词、用户、来源等规则
   - 「🔄 刷新屏蔽」——对当前页面重新执行屏蔽
   - 「🗑️ 清空全部屏蔽」——清空所有屏蔽规则

## 配置说明

- 存储键：`wb_keywords`（关键词）、`wb_blocked_users`（用户）、`wb_sources`（来源）、`wb_topics`（超话）、`wb_block_all_super_topic`（全部超话开关）、`wb_block_all_blue_v`（全部蓝 V 开关）
- 规则保存在本地，不上传

## 兼容网站

- `https://weibo.com/*`
- `https://*.weibo.com/*`

## 更新日志

### 3.4.1
- 补齐中文描述与反馈渠道

### 3.4.0
- 支持屏蔽全部超话与全部蓝 V

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer

