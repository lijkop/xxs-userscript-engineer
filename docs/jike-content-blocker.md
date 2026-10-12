# 即刻内容屏蔽器

> 版本：3.2.1 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

按关键词屏蔽即刻时间线内容，支持已读隐藏与去重处理。

## 功能

- 关键词屏蔽，命中即隐藏
- 已读内容可自动隐藏
- 对已处理内容去重，避免重复计算导致的白屏问题
- MutationObserver 跟踪时间线滚动加载

## 使用方法

1. 安装后打开 web.okjike.com
2. 点击油猴菜单「屏蔽设置」维护关键词与开关
3. 配置即时生效

## 配置说明

- 存储键：`jike_blocker_config_v3`（配置）、`jike_seen_ids`（已读记录）
- 数据保存在本地，不上传

## 兼容网站

- `https://web.okjike.com/*`

## 更新日志

### 3.2.1
- 补齐中文描述与反馈渠道

### 3.2.0
- 修复「已读隐藏」导致的白屏问题，优化屏蔽逻辑

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer

