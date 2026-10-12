# X (Twitter) 内容屏蔽器

> 版本：2.1.2 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

按关键词、用户名与互动数据隐藏 X/Twitter 时间线里的推文与回复，隐藏后不残留空白。

## 功能

- 关键词屏蔽：推文正文命中即隐藏
- 用户名屏蔽：指定账号的内容直接过滤
- 零评论过滤：隐藏没有回复的推文
- 无缝隐藏：处理 DOM 复用场景，避免出现留白断层
- 使用 MutationObserver 跟踪时间线滚动加载

## 使用方法

1. 安装后打开 x.com 或 twitter.com
2. 点击油猴菜单「打开净网控制台」配置规则
3. 规则即时生效并保存在本地

## 配置说明

- 配置存储键：`x_block_config`
- 控制台中维护关键词、用户名与过滤开关
- 数据保存在本地，不上传

## 兼容网站

- `*://*.twitter.com/*`
- `*://*.x.com/*`

## 更新日志

### 2.1.2
- 补齐中文描述与反馈渠道

### 2.1.1
- 修正域名匹配：支持 `www.twitter.com` 等子域

### 2.1.0
- 新增零评论过滤；解决 DOM 复用导致的留白断层问题

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer

