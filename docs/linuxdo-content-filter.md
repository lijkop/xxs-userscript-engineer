# Linux.do 内容过滤器

> 版本：1.0.1 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

按关键词过滤 Linux.do 的标签、标题、主帖正文与评论回复，减少无关内容干扰。

## 功能

- 四个维度独立过滤：标签 / 标题 / 主帖正文 / 评论回复
- 支持维护多个关键词，命中即隐藏
- 在 `document-start` 阶段注入，页面渲染前完成处理，不出现内容闪现
- 使用 MutationObserver 跟踪动态加载的内容

## 使用方法

1. 安装后打开 linux.do
2. 通过脚本内置的过滤面板维护关键词
3. 按 `Esc` 键关闭面板，配置即时生效

## 配置说明

- 关键词保存在本地存储，不上传
- 面板内可分别维护四个维度的关键词列表

## 兼容网站

- `https://linux.do/*`
- `https://*.linux.do/*`

## 更新日志

### 1.0.1
- 补齐中文描述与反馈渠道

### 1.0.0
- 首个正式版本：标签、标题、正文、评论四维度过滤

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer

