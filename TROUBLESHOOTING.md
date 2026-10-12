# 排查手册

## 一、脚本完全不生效

按顺序检查：

1. **`@match` 是否覆盖你实际访问的域名**
   最常见的坑：站点同时存在带 `www` 和不带 `www` 的地址，而 `@match` 只写了其中一种，脚本根本不会注入。
   复核方法：Tampermonkey 面板 → 对应脚本 → 「设置」里能看到已注册的匹配规则；或在页面控制台执行 `location.href` 看实际地址。

   | 站点 | 2026-10-13 修正前的问题 |
   |---|---|
   | 小黑盒 | 只匹配 `www.xiaoheihe.cn`，而 `xiaoheihe.cn` 不会跳转到 www（实测两者都直接返回 200） |
   | Reddit | 只匹配 `www.reddit.com` |
   | X / Twitter | 只匹配 `twitter.com`，不匹配 `www.twitter.com` |
   | 豆瓣 | 只匹配 `www.douban.com` |
   | 知乎回答剪藏 / 小红书评论批量复制 | 只匹配 `www.*` 形式 |
2. **脚本是否真的注入**
   看 Tampermonkey 面板里脚本条目右上角的数字角标（当前页面正在运行的脚本数）。
3. **有没有 JS 报错**
   F12 → Console 看红色报错。多数是页面改版导致选择器失效。
4. **是否需要登录**
   部分站点未登录时不渲染内容，脚本自然也找不到目标元素。

## 二、失效站点的诊断代码

在目标页面按 F12，把下面代码粘进 Console 回车，把输出发给我：

```js
// 1) 当前地址
console.log('URL:', location.href);

// 2) 列出页面里与业务相关的 class（关键词按需修改）
const set = new Set();
document.querySelectorAll('[class]').forEach(el => {
  el.classList.forEach(c => { if (/bbs|content|comment|cpt/i.test(c)) set.add(c); });
});
console.log('候选 class：', [...set].sort());

// 3) 看具体选择器命中多少个元素
['a.hb-cpt__bbs-content', '.bbs-content__title', '.comment-item__content'].forEach(sel => {
  console.log(sel, '=>', document.querySelectorAll(sel).length);
});
```

> 小黑盒两个脚本目前**只修了域名匹配，选择器尚未在真实页面验证**——`xiaoheihe.cn/app/bbs/home` 初始 HTML 只有 3.4KB（纯 SPA 空壳），静态抓取不到类名。跑一遍上面的代码就能确认类名是否还叫 `hb-cpt__bbs-content`。

## 三、更新不生效

- 确认 `@version` 已提升：版本不变，客户端不会认为有新版本。
- GitHub raw 有约 5 分钟 CDN 缓存，刚 push 完立刻检查更新可能仍拿到旧版本。
- Tampermonkey 默认每 24 小时检查一次更新，可手动点「实用工具 → 检查更新脚本」，或在设置里改为「总是」。
- 想确认 GitHub 上的内容是否已更新，把地址里的 `main` 换成 `refs/heads/main` 再访问。

## 四、Greasy Fork 未同步

- 该脚本是否已设置「从外部源码同步」，且 `@version` 比线上大。
- push 事件里是否**包含**这个脚本文件（GF 只处理本次改动涉及的文件）。
- Webhook 是否配置且 Active；GitHub 仓库 → Settings → Webhooks → 点进去看 Recent Deliveries 的响应码。
- 同步类型显示「自动」说明 Webhook 还没触发过，等一次 push 或手动点「立即同步」。
