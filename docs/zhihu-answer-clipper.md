# 知乎回答剪藏

> 版本：1.6.2 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

提取知乎问题页的回答正文并复制到剪贴板，便于剪藏与归档。

## 功能

- 一键抓取回答正文并复制到剪贴板
- 提取时清理无关元素，保留可读内容
- MutationObserver 跟踪回答动态加载

## 使用方法

1. 安装后打开知乎问题页面
2. 点击页面上的剪藏按钮，回答正文即复制到剪贴板

## 配置说明

无需配置。脚本不读写本地存储。

## 兼容网站

- `*://*.zhihu.com/question/*`

## 更新日志

### 1.6.2
- 补齐中文描述与反馈渠道

### 1.6.1
- 修正域名匹配：支持 zhihu.com 各子域（原先只匹配带 www 的地址）

### 1.6.0
- 提取逻辑优化

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer

