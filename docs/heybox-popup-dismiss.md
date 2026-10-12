# 小黑盒弹窗自动关闭

> 版本：1.0.2 · 作者：小小薯（XXS） · 反馈：[Telegram 频道](https://t.me/zzyyffxx)

## 简介

自动点击小黑盒页面弹窗上的「取消」按钮，把打断浏览的弹窗静默关掉。

## 功能

- 页面加载后扫描页面元素，命中文本为「取消」的按钮即点击
- 使用 MutationObserver 监听 DOM 变化，后续新弹出的弹窗同样会被处理
- 纯 DOM 操作，不调用任何站点接口、不发送网络请求

## 使用方法

安装后打开 xiaoheihe.cn 任意页面即自动生效，无需任何操作。

## 配置说明

无需配置。脚本不读写本地存储，也不申请任何特权 API。

## 兼容网站

- `https://*.xiaoheihe.cn/*`

## 更新日志

### 1.0.2
- 补齐中文描述与反馈渠道

### 1.0.1
- 修正域名匹配：`xiaoheihe.cn` 与 `www.xiaoheihe.cn` 均可生效（此前只匹配带 www 的地址，导致脚本不注入）

### 1.0.0
- 首个正式版本

## 反馈

- Telegram 频道：https://t.me/zzyyffxx —— 通过这里联系我，修 Bug 更快
- 源码与 Issue：https://github.com/lijkop/xxs-userscript-engineer

