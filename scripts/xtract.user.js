// ==UserScript==
// ==UserScript==
// @name         Xtract
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  X（Twitter）内容采集：抓用户主页帖子、帖子下的转帖用户与引用推文；手动或自动滑动持续记录，一键复制正文+评论，导出 JSON / CSV / Markdown。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx
// @description:zh-CN X（Twitter）内容采集：抓用户主页帖子、帖子下的转帖用户与引用推文；手动或自动滑动持续记录，一键复制正文+评论，导出 JSON / CSV / Markdown。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx
// @description:en X (Twitter) content collector: scrape a user's timeline posts, the repost users and quote tweets of a post; keep collecting while you scroll manually or automatically, copy the post with its comments, export JSON / CSV / Markdown. Feedback: https://t.me/zzyyffxx
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/xtract.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/xtract.user.js
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        GM_setClipboard
// @license      MIT
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  /* ============================================================
   * 1. 常量与选择器
   * X 的 class 是构建时随机的（css-g5y9jx 之类），只能依赖 data-testid。
   * ============================================================ */

  const SEL = {
    article: 'article[data-testid="tweet"]',
    userName: '[data-testid="User-Name"]',
    tweetText: '[data-testid="tweetText"]',
    avatar: '[data-testid^="UserAvatar-Container-"]',
    group: '[role="group"][aria-label]',
    social: '[data-testid="socialContext"]',
    photo: '[data-testid="tweetPhoto"] img',
    videoPlayer: '[data-testid="videoPlayer"], [data-testid="videoComponent"]',
    card: '[data-testid="card.wrapper"]',
    userCell: '[data-testid="UserCell"]',
    userDesc: '[data-testid="UserDescription"]',
    timeline: '[data-testid="primaryColumn"]',
  };

  const RESERVED = new Set([
    "home", "explore", "notifications", "messages", "i", "search", "settings",
    "compose", "bookmarks", "jobs", "communities", "premium", "tos", "privacy",
    "login", "logout", "signup", "hashtag", "lists",
  ]);

  const DEFAULTS = {
    target: 300,
    delay: 1200,
    autoScroll: false, // 默认不自动滚：你手动滑，脚本持续记录
    withQuoted: true,
    withMedia: true,
    collapsed: true, // 面板默认收起，只留悬浮条；记住上次状态
  };

  const STORE_KEY = "x_scraper_settings_v1";

  /* ============================================================
   * 2. 工具函数
   * ============================================================ */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 把节点渲染成纯文本：emoji 是 <img alt="😀">，换行来自 <br> */
  function nodeText(el) {
    if (!el) return "";
    let out = "";
    const walk = (n) => {
      if (n.nodeType === 3) {
        out += n.nodeValue;
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === "IMG") {
        out += n.getAttribute("alt") || "";
        return;
      }
      if (tag === "BR") {
        out += "\n";
        return;
      }
      for (const child of n.childNodes) walk(child);
    };
    walk(el);
    return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  /** "1,234" / "1.2万" / "3K" / "2M" → 数字 */
  function parseCount(text) {
    if (!text) return 0;
    const m = String(text).match(/([\d.,]+)\s*(万|千|亿|k|m|b)?/i);
    if (!m) return 0;
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) return 0;
    const unit = (m[2] || "").toLowerCase();
    if (unit === "万") n *= 1e4;
    else if (unit === "千") n *= 1e3;
    else if (unit === "亿") n *= 1e8;
    else if (unit === "k") n *= 1e3;
    else if (unit === "m") n *= 1e6;
    else if (unit === "b") n *= 1e9;
    return Math.round(n);
  }

  /**
   * 解析动作栏的汇总 aria-label，例如：
   *   "25 回复、10 次转帖、82 喜欢、17 书签、11483 次观看"
   *   "25 replies, 10 reposts, 82 likes, 11483 views"
   * 按关键词匹配，不依赖字段顺序和语言。
   */
  function parseCounts(label) {
    const out = { reply: 0, retweet: 0, like: 0, bookmark: 0, view: 0 };
    if (!label) return out;
    const parts = label.split(/[、,，;；]/).map((s) => s.trim()).filter(Boolean);
    const rules = [
      ["reply", /回复|repl/i],
      ["retweet", /转帖|转推|转发|repost|retweet/i],
      ["like", /喜欢|点赞|like/i],
      ["bookmark", /书签|收藏|bookmark/i],
      ["view", /观看|查看|浏览|view|impression/i],
    ];
    const hit = new Set();
    for (const part of parts) {
      for (const [key, re] of rules) {
        if (hit.has(key)) continue;
        if (re.test(part)) {
          out[key] = parseCount(part);
          hit.add(key);
          break;
        }
      }
    }
    // 关键词全部落空时（极端语言环境）退回按位置：回复/转帖/喜欢/书签/观看
    if (hit.size === 0 && parts.length >= 3) {
      const keys = ["reply", "retweet", "like", "bookmark", "view"];
      parts.forEach((p, i) => {
        if (keys[i]) out[keys[i]] = parseCount(p);
      });
    }
    return out;
  }

  function absUrl(href) {
    try {
      return new URL(href, location.origin).href;
    } catch {
      return "";
    }
  }

  /** 页面类型识别：主页 / 帖子详情 / 转帖列表 / 引用列表 */
  function pageInfo() {
    const path = location.pathname;
    const status = path.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)(?:\/(retweets|quotes))?/);
    if (status) {
      return { kind: status[3] || "status", handle: status[1], id: status[2] };
    }
    const profile = path.match(/^\/([A-Za-z0-9_]+)\/?$/);
    if (profile && !RESERVED.has(profile[1].toLowerCase())) {
      return { kind: "profile", handle: profile[1] };
    }
    return { kind: "other", handle: "" };
  }

  /* ============================================================
   * 3. 解析器
   * ============================================================ */

  function parseTweet(art, opts) {
    const timeEl = art.querySelector('a[href*="/status/"] time');
    const linkEl = timeEl ? timeEl.closest("a") : null;
    const url = linkEl ? absUrl(linkEl.getAttribute("href")) : "";
    const id = (url.match(/status\/(\d+)/) || [])[1];
    if (!id) return null;

    // 作者：头像容器的 data-testid 直接带 handle，最稳
    const avatarEl = art.querySelector(SEL.avatar);
    let handle =
      (avatarEl && avatarEl.getAttribute("data-testid").replace("UserAvatar-Container-", "")) || "";
    const nameBoxes = art.querySelectorAll(SEL.userName);
    const nameBox = nameBoxes[0];
    if (!handle && nameBox) {
      const a = nameBox.querySelector('a[href^="/"]');
      handle = a ? a.getAttribute("href").slice(1) : "";
    }
    if (!handle) handle = url.split("/")[3] || "";

    const displayName = nameBox ? nodeText(nameBox.querySelector("a span") || nameBox).split("\n")[0] : "";

    // 正文；第二条 tweetText 属于嵌套的引用推文
    const textEls = [...art.querySelectorAll(SEL.tweetText)];
    const text = textEls.length ? nodeText(textEls[0]) : "";

    // 引用卡片不一定有文字（纯图片引用），靠「引用 / Quote」这个小标题兜底判断
    const hasQuoteLabel = [...art.querySelectorAll('div[dir="ltr"]')].some((el) => {
      const label = el.textContent.trim();
      return (label === "引用" || label === "Quote") && el.children.length === 0;
    });
    // 开了自动翻译时，tweetText 是译文，标记出来免得误当成原文
    const translated = /翻译自|Translated from/i.test(art.textContent || "");

    let quotedText = "";
    let quotedAuthor = "";
    let quotedHandle = "";
    if (opts.withQuoted && (textEls.length > 1 || hasQuoteLabel)) {
      quotedText = textEls.length > 1 ? nodeText(textEls[1]) : "";
      const qNameBox = nameBoxes[1];
      if (qNameBox) {
        const qa = qNameBox.querySelector('a[href^="/"]');
        quotedHandle = qa ? qa.getAttribute("href").slice(1).split("/")[0] : "";
        // 昵称和 @handle 常在同一个 <a> 里，按「是否以 @ 开头」区分，避免拼成一串
        const spans = [...qNameBox.querySelectorAll("span")]
          .map((s) => s.textContent.trim())
          .filter(Boolean);
        const nameText = spans.find((t) => !t.startsWith("@") && !/^[·•]/.test(t));
        const handleText = spans.find((t) => t.startsWith("@"));
        if (nameText) quotedAuthor = nameText;
        if (!quotedHandle && handleText) {
          quotedHandle = handleText.replace(/^@/, "").split(/[·•\s]/)[0];
        }
      }
    }

    const groupLabel = art.querySelector(SEL.group)?.getAttribute("aria-label") || "";
    const counts = parseCounts(groupLabel);

    let media = [];
    if (opts.withMedia) {
      const photos = [...art.querySelectorAll(SEL.photo)]
        .map((img) => (img.currentSrc || img.src || "").replace(/[?&]name=[^&]+/, "&name=orig"))
        .filter((src) => src.includes("pbs.twimg.com") && !src.includes("profile_images"));
      const videos = [...art.querySelectorAll("video")]
        .map((v) => v.getAttribute("poster") || (v.querySelector("source") || {}).src || "")
        .filter(Boolean);
      media = [...new Set([...photos, ...videos])];
    }

    const cardLink = art.querySelector(`${SEL.card} a[href^="http"]`);
    const socialContext = (art.querySelector(SEL.social)?.textContent || "").trim();
    const createdAt = timeEl ? timeEl.getAttribute("datetime") || "" : "";

    return {
      type: "tweet",
      id,
      url,
      author: displayName,
      handle,
      created_at: createdAt,
      text,
      reply: counts.reply,
      retweet: counts.retweet,
      like: counts.like,
      bookmark: counts.bookmark,
      view: counts.view,
      quoted_author: quotedAuthor,
      quoted_handle: quotedHandle,
      quoted_text: quotedText,
      translated,
      media: media.join(" "),
      card: cardLink ? absUrl(cardLink.getAttribute("href")) : "",
      social_context: socialContext,
      scraped_at: new Date().toISOString(),
    };
  }

  /** 转帖列表页（/retweets）里的用户行 */
  function parseUserCell(cell) {
    const link = cell.querySelector('a[href^="/"]:not([href*="/status/"])');
    const handle = link ? link.getAttribute("href").replace(/^\//, "").split("/")[0] : "";
    if (!handle) return null;
    const nameEl = cell.querySelector('div[dir="ltr"] span') || link;
    const name = nodeText(nameEl).split("\n")[0];
    const bio = nodeText(cell.querySelector(SEL.userDesc));
    const followText = [...cell.querySelectorAll("span")]
      .map((s) => s.textContent.trim())
      .find((t) => /关注了你|Follows you|被.*关注/i.test(t)) || "";

    return {
      type: "user",
      handle,
      url: `https://x.com/${handle}`,
      author: name,
      bio,
      note: followText,
      scraped_at: new Date().toISOString(),
    };
  }

  /* ============================================================
   * 4. 采集器
   * ============================================================ */

  const state = {
    running: false,
    stopReason: "",
    records: new Map(), // key -> record
    scrolls: 0,
    idleRounds: 0,
    startedAt: 0,
  };

  const opts = { ...DEFAULTS };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) Object.assign(opts, JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(opts));
    } catch {
      /* ignore */
    }
  }

  /** 扫一遍当前 DOM，收集新增记录，返回本轮新增数 */
  function collectOnce() {
    const info = pageInfo();
    let added = 0;

    const isRetweetList = info.kind === "retweets";
    if (isRetweetList) {
      document.querySelectorAll(SEL.userCell).forEach((cell) => {
        const rec = parseUserCell(cell);
        if (!rec) return;
        const key = `u:${rec.handle}`;
        if (!state.records.has(key)) {
          state.records.set(key, rec);
          added++;
        }
      });
    }

    document.querySelectorAll(SEL.article).forEach((art) => {
      // 转帖列表页里也可能混着推广/推荐推文，照收
      const rec = parseTweet(art, opts);
      if (!rec) return;
      const key = `t:${rec.id}`;
      if (!state.records.has(key)) {
        state.records.set(key, rec);
        added++;
      }
    });

    return added;
  }

  async function scrollStep() {
    const doc = document.documentElement;
    const target = doc.scrollHeight;
    window.scrollTo(0, Math.min(target, window.scrollY + window.innerHeight * 1.2));
    if (window.scrollY + window.innerHeight >= target - 4) {
      window.scrollTo(0, target);
    }
    state.scrolls++;
  }

  function stop(reason) {
    if (!state.running) return;
    state.running = false;
    state.stopReason = reason;
    ui.render();
    ui.log(`已暂停：${reason}`);
    const n = state.records.size;
    // 暂停后自动展开面板，方便直接点「复制 MD」
    ui.setCollapsed(false);
    ui.toast(`已暂停 · 共 ${n} 条，可点「复制 MD」`, 2600);
  }

  async function start() {
    if (state.running) return;
    const info = pageInfo();
    if (info.kind === "other") {
      ui.log("当前页面不是主页或帖子页，先在 x.com 打开目标页面");
      ui.toast("这个页面不支持抓取，请打开主页或帖子页", 2600);
      return;
    }
    state.running = true;
    state.stopReason = "";
    state.scrolls = 0;
    state.idleRounds = 0;
    state.startedAt = Date.now();
    ui.render();
    ui.log(`开始抓取（${describePage(info)}），目标 ${opts.target} 条`);

    // 面板自动收起，避免挡住页面；进度看右下角悬浮条，点它恢复面板
    ui.setCollapsed(true);
    if (opts.autoScroll) {
      ui.toast(`开始抓取 · ${describePage(info)}`);
    } else {
      ui.toast("开始记录 · 滑到底后点 ❚❚ 暂停", 2600);
    }

    let exceededNotified = false;

    while (state.running) {
      collectOnce();
      ui.render();

      // 手动模式：不自己滚、不自动停，只持续把滚动出来的新内容收进列表
      if (!opts.autoScroll) {
        if (!exceededNotified && state.records.size >= opts.target) {
          exceededNotified = true;
          ui.log(`已达 ${state.records.size} 条（目标 ${opts.target}），继续记录中`);
        }
        await sleep(700);
        continue;
      }

      if (state.records.size >= opts.target) {
        stop(`已达目标 ${opts.target} 条`);
        break;
      }
      if (state.scrolls > 800) {
        stop("滚动次数过多，安全停止");
        break;
      }

      const before = state.records.size;
      await scrollStep();
      // 抖动一下等待时间，避免固定节奏
      await sleep(opts.delay * (0.75 + Math.random() * 0.5));

      if (state.records.size === before) {
        state.idleRounds++;
        if (state.idleRounds >= 3) {
          // 再尝试直接跳到底部一次，防止中途被「显示更多」卡住
          window.scrollTo(0, document.documentElement.scrollHeight);
          await sleep(opts.delay * 1.5);
          if (collectOnce() === 0) {
            stop("没有更多内容");
            break;
          }
          state.idleRounds = 0;
        }
      } else {
        state.idleRounds = 0;
      }
    }
    ui.render();
  }

  function describePage(info) {
    if (info.kind === "profile") return `@${info.handle} 主页`;
    if (info.kind === "retweets") return `帖子 ${info.id} 的转帖用户`;
    if (info.kind === "quotes") return `帖子 ${info.id} 的引用推文`;
    if (info.kind === "status") return `帖子 ${info.id} 详情`;
    return "未知页面";
  }

  /* ============================================================
   * 5. 导出
   * ============================================================ */

  const CSV_COLUMNS = [
    ["type", "类型"],
    ["id", "推文ID"],
    ["handle", "作者账号"],
    ["author", "作者名称"],
    ["created_at", "发布时间"],
    ["text", "正文"],
    ["reply", "回复数"],
    ["retweet", "转帖数"],
    ["like", "喜欢数"],
    ["bookmark", "书签数"],
    ["view", "观看数"],
    ["quoted_author", "引用作者"],
    ["quoted_handle", "引用账号"],
    ["quoted_text", "引用正文"],
    ["translated", "是否译文"],
    ["media", "媒体链接"],
    ["card", "卡片链接"],
    ["social_context", "上下文"],
    ["bio", "简介"],
    ["note", "备注"],
    ["url", "链接"],
    ["scraped_at", "抓取时间"],
  ];

  function toJSON() {
    const list = [...state.records.values()];
    return JSON.stringify(
      {
        source: location.href,
        page: describePage(pageInfo()),
        exported_at: new Date().toISOString(),
        count: list.length,
        items: list,
      },
      null,
      2
    );
  }

  function toCSV() {
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""').replace(/\r?\n/g, "\\n")}"`;
    };
    const header = CSV_COLUMNS.map(([, label]) => esc(label)).join(",");
    const rows = [...state.records.values()].map((rec) =>
      CSV_COLUMNS.map(([key]) => esc(rec[key] ?? "")).join(",")
    );
    return "\uFEFF" + [header, ...rows].join("\r\n");
  }

  /** ISO 时间转本地 "YYYY-MM-DD HH:mm" */
  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /** 引用行加 blockquote 前缀 */
  function quoteLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => `> ${line}`)
      .join("\n");
  }

  function tweetToMarkdown(rec, idx) {
    const lines = [];
    lines.push(`### ${idx}. ${rec.author || "未知作者"} (@${rec.handle})`);
    lines.push("");
    lines.push(`- 时间：${fmtTime(rec.created_at)}`);
    lines.push(`- 链接：${rec.url}`);
    lines.push(
      `- 数据：回复 ${rec.reply} · 转帖 ${rec.retweet} · 喜欢 ${rec.like} · 书签 ${rec.bookmark} · 观看 ${rec.view}`
    );
    if (rec.social_context) lines.push(`- 上下文：${rec.social_context}`);
    if (rec.translated) lines.push("- 备注：页面为机器译文");
    lines.push("");
    if (rec.text) {
      lines.push(rec.text);
      lines.push("");
    }
    if (rec.quoted_text || rec.quoted_handle || rec.quoted_author) {
      const who = [rec.quoted_author, rec.quoted_handle ? `(@${rec.quoted_handle})` : ""]
        .filter(Boolean)
        .join(" ");
      lines.push(`> 引用 ${who}`.trim());
      if (rec.quoted_text) lines.push(quoteLines(rec.quoted_text));
      lines.push("");
    }
    const media = String(rec.media || "").split(" ").filter(Boolean);
    if (media.length) {
      lines.push("- 媒体：");
      for (const m of media) lines.push(`  - ${m}`);
      lines.push("");
    }
    if (rec.card) {
      lines.push(`- 卡片：${rec.card}`);
      lines.push("");
    }
    return lines.join("\n").trimEnd();
  }

  function userToMarkdown(rec) {
    return [
      `### ${rec.author || "未知"} (@${rec.handle})`,
      "",
      `- 主页：${rec.url}`,
      rec.bio ? `- 简介：${rec.bio.replace(/\r?\n/g, " ")}` : "",
      rec.note ? `- 备注：${rec.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function toMarkdown() {
    const all = [...state.records.values()];
    const tweets = all.filter((r) => r.type === "tweet");
    const users = all.filter((r) => r.type === "user");
    const info = pageInfo();

    const blocks = [
      [
        `# X 抓取结果 · ${describePage(info)}`,
        "",
        `- 来源：${location.href}`,
        `- 数量：${all.length} 条${users.length ? `（推文 ${tweets.length} · 用户 ${users.length}）` : ""}`,
        `- 导出时间：${fmtTime(new Date().toISOString())}`,
      ].join("\n"),
    ];
    if (tweets.length) {
      blocks.push("## 推文\n\n" + tweets.map((r, i) => tweetToMarkdown(r, i + 1)).join("\n\n---\n\n"));
    }
    if (users.length) {
      blocks.push("## 用户\n\n" + users.map(userToMarkdown).join("\n\n"));
    }
    return blocks.join("\n\n") + "\n";
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function exportJSON() {
    if (!state.records.size) {
      ui.log("还没有数据");
      ui.toast("还没有抓到数据", 2000);
      return;
    }
    const info = pageInfo();
    download(`x-${info.kind}-${info.handle || "page"}-${stamp()}.json`, toJSON(), "application/json;charset=utf-8");
    ui.log(`已导出 JSON（${state.records.size} 条）`);
    ui.toast(`已导出 JSON · ${state.records.size} 条`);
  }

  function exportCSV() {
    if (!state.records.size) {
      ui.log("还没有数据");
      ui.toast("还没有抓到数据", 2000);
      return;
    }
    const info = pageInfo();
    download(`x-${info.kind}-${info.handle || "page"}-${stamp()}.csv`, toCSV(), "text/csv;charset=utf-8");
    ui.log(`已导出 CSV（${state.records.size} 条）`);
    ui.toast(`已导出 CSV · ${state.records.size} 条`);
  }

  function exportMD() {
    if (!state.records.size) {
      ui.log("还没有数据");
      ui.toast("还没有抓到数据", 2000);
      return;
    }
    const info = pageInfo();
    download(`x-${info.kind}-${info.handle || "page"}-${stamp()}.md`, toMarkdown(), "text/markdown;charset=utf-8");
    ui.log(`已导出 MD（${state.records.size} 条）`);
    ui.toast(`已导出 Markdown · ${state.records.size} 条`);
  }

  async function copyMD() {
    if (!state.records.size) {
      ui.log("还没有数据");
      ui.toast("还没有抓到数据", 2000);
      return;
    }
    const text = toMarkdown();
    try {
      if (typeof GM_setClipboard === "function") GM_setClipboard(text, "text");
      else await navigator.clipboard.writeText(text);
      ui.log(`已复制 Markdown（${state.records.size} 条，${text.length} 字符）`);
      ui.toast(`已复制 MD · ${state.records.size} 条`);
    } catch (e) {
      ui.log(`复制失败：${e.message}`);
    }
  }

  /** 当前详情页：主帖 + 下面的评论 / 跟评（按 DOM 顺序，用左侧缩进估算层级） */
  function collectPostWithReplies() {
    const arts = [...document.querySelectorAll(SEL.article)];
    if (!arts.length) return null;
    const baseLeft = arts[0].getBoundingClientRect().left;
    const items = [];
    arts.forEach((art, idx) => {
      const rec = parseTweet(art, { ...opts, withQuoted: true, withMedia: true });
      if (!rec) return;
      const left = art.getBoundingClientRect().left;
      const depth = idx === 0 ? 0 : Math.min(3, Math.max(0, Math.round((left - baseLeft) / 24)));
      items.push({ ...rec, depth });
    });
    return items.length ? items : null;
  }

  function postToMarkdown(items) {
    const main = items[0];
    const replies = items.slice(1);
    const lines = [];
    lines.push(`# ${main.author} (@${main.handle})`);
    lines.push("");
    lines.push(`- 时间：${fmtTime(main.created_at)}`);
    lines.push(`- 链接：${main.url}`);
    lines.push(
      `- 数据：回复 ${main.reply} · 转帖 ${main.retweet} · 喜欢 ${main.like} · 书签 ${main.bookmark} · 观看 ${main.view}`
    );
    if (main.translated) lines.push("- 备注：页面为机器译文");
    lines.push("");
    if (main.text) {
      lines.push(main.text);
      lines.push("");
    }
    if (main.quoted_text || main.quoted_handle) {
      const who = [main.quoted_author, main.quoted_handle ? `(@${main.quoted_handle})` : ""]
        .filter(Boolean)
        .join(" ");
      lines.push(`> 引用 ${who}`.trim());
      if (main.quoted_text) lines.push(quoteLines(main.quoted_text));
      lines.push("");
    }
    const media = String(main.media || "").split(" ").filter(Boolean);
    if (media.length) {
      lines.push("- 媒体：");
      for (const m of media) lines.push(`  - ${m}`);
      lines.push("");
    }

    if (replies.length) {
      lines.push(`## 评论（${replies.length}）`);
      lines.push("");
      replies.forEach((r, i) => {
        const pad = "   ".repeat(r.depth || 0);
        lines.push(`${pad}${i + 1}. **${r.author}** (@${r.handle}) · ${fmtTime(r.created_at)}`);
        const body = (r.text || "").trim();
        if (body) lines.push(body.split(/\r?\n/).map((l) => `${pad}   ${l}`).join("\n"));
        if (r.quoted_text) {
          lines.push(`${pad}   > 引用 ${r.quoted_author} (@${r.quoted_handle})：${r.quoted_text.replace(/\n/g, " ")}`);
        }
        lines.push("");
      });
    }
    return lines.join("\n").trimEnd() + "\n";
  }

  async function copyPost() {
    // 只有帖子详情页才有“主帖 + 评论”的概念
    if (pageInfo().kind !== "status") {
      ui.toast("请在帖子详情页使用（点开一条帖子）", 2600);
      return;
    }
    const items = collectPostWithReplies();
    if (!items) {
      ui.toast("这个页面没有可复制的帖子", 2400);
      return;
    }
    const md = postToMarkdown(items);
    try {
      if (typeof GM_setClipboard === "function") GM_setClipboard(md, "text");
      else await navigator.clipboard.writeText(md);
      ui.log(`已复制正文 + ${items.length - 1} 条评论`);
      ui.toast(`已复制正文 + ${items.length - 1} 条评论`, 2400);
    } catch (e) {
      ui.toast(`复制失败：${e.message}`, 2600);
    }
  }

  async function copyJSON() {
    if (!state.records.size) {
      ui.log("还没有数据");
      ui.toast("还没有抓到数据", 2000);
      return;
    }
    const text = toJSON();
    try {
      if (typeof GM_setClipboard === "function") GM_setClipboard(text, "text");
      else await navigator.clipboard.writeText(text);
      ui.log(`已复制 JSON（${state.records.size} 条）`);
      ui.toast(`已复制 JSON · ${state.records.size} 条`);
    } catch (e) {
      ui.log(`复制失败：${e.message}`);
    }
  }

  /* ============================================================
   * 6. 界面（Shadow DOM 隔离，避免被 X 的样式污染）
   * ============================================================ */

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
    /* 关键：.pill/.toast 自带 display，不加强制规则的话 hidden 属性会失效 */
    [hidden] { display: none !important; }
    .panel {
      position: fixed; top: 80px; right: 20px; width: 320px; z-index: 2147483000;
      background: #fff; color: #0f1419; border: 1px solid #e1e8ed; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,.18); overflow: hidden; font-size: 13px;
    }
    .panel.dark { background: #15202b; color: #e7e9ea; border-color: #38444d; }
    header {
      display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: move;
      background: linear-gradient(135deg, #1d9bf0, #0f7fd1); color: #fff; user-select: none;
    }
    header .title { font-weight: 700; font-size: 13px; flex: 1; }
    header button {
      all: unset; cursor: pointer; width: 22px; height: 22px; line-height: 22px; text-align: center;
      border-radius: 6px; font-size: 14px;
    }
    header button:hover { background: rgba(255,255,255,.22); }
    .body { padding: 12px; display: grid; gap: 10px; }
    /* 收起 = 整个面板消失，只留右下角小圆点，避免一条标题栏常驻 */
    .panel.collapsed { display: none; }
    .row { display: flex; align-items: center; gap: 8px; }
    .row label { flex: 1; color: #536471; }
    .panel.dark .row label { color: #8899a6; }
    input[type="number"] {
      width: 84px; padding: 5px 7px; border: 1px solid #cfd9de; border-radius: 6px;
      background: transparent; color: inherit; font-size: 13px;
    }
    .panel.dark input[type="number"] { border-color: #38444d; }
    .checks { display: grid; gap: 6px; }
    .checks label { display: flex; align-items: center; gap: 6px; color: inherit; cursor: pointer; }
    .page { font-size: 12px; color: #536471; background: #f7f9f9; padding: 6px 8px; border-radius: 6px; }
    .panel.dark .page { color: #8899a6; background: #1c2732; }
    .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    button.act {
      padding: 8px; border-radius: 8px; border: 1px solid #cfd9de; background: #fff; color: #0f1419;
      cursor: pointer; font-size: 13px; font-weight: 600;
    }
    .panel.dark button.act { background: #1c2732; border-color: #38444d; color: #e7e9ea; }
    button.act:hover { border-color: #1d9bf0; color: #1d9bf0; }
    button.act.primary { background: #1d9bf0; border-color: #1d9bf0; color: #fff; }
    button.act.primary:hover { background: #1a8cd8; color: #fff; }
    button.act.danger:hover { border-color: #f4212e; color: #f4212e; }
    button.act:disabled { opacity: .45; cursor: not-allowed; }
    .status { font-size: 12px; color: #536471; display: flex; justify-content: space-between; }
    .panel.dark .status { color: #8899a6; }
    .log { font-size: 11.5px; color: #536471; max-height: 84px; overflow: auto; line-height: 1.55; }
    .panel.dark .log { color: #8899a6; }
    .hint { font-size: 11px; color: #8899a6; line-height: 1.6; white-space: pre-line; }
    .badge { font-size: 11px; padding: 1px 6px; border-radius: 999px; background: rgba(255,255,255,.24); }

    /* 收起后的入口：空闲时只有一个半透明小圆点，不占版面 */
    .pill {
      position: fixed; right: 18px; bottom: 18px; z-index: 2147483001;
      display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 11px;
      border-radius: 999px; background: #1d9bf0; color: #fff; font-size: 12px;
      box-shadow: 0 6px 18px rgba(0,0,0,.24); cursor: pointer; user-select: none;
      transition: opacity .18s ease, transform .18s ease;
    }
    /* 空闲无数据：缩成一个小圆按钮，但要看得见 —— 实色 + 阴影 + hover 放大 */
    .pill.solo {
      width: 46px; height: 46px; padding: 0; justify-content: center;
      background: #1d9bf0; color: #fff; opacity: .92;
      box-shadow: 0 6px 18px rgba(29,155,240,.42);
    }
    .pill.solo:hover { opacity: 1; transform: scale(1.06); }
    .pill.solo #pillText, .pill.solo .dot, .pill.solo .pill-btn { display: none; }
    .pill.solo .icon { display: block; }
    .pill .icon { display: none; width: 20px; height: 20px; fill: #fff; }

    .pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #7ef0a2; flex: none; }
    .pill.working .dot { animation: pulse 1.2s infinite; }
    .pill.idle { background: #536471; }
    .pill.idle .dot { background: #ffd166; animation: none; }

    .pill-btn {
      all: unset; cursor: pointer; padding: 2px 5px; border-radius: 5px;
      font-size: 11px; line-height: 1; background: rgba(255,255,255,.22);
    }
    .pill-btn:hover { background: rgba(255,255,255,.42); }
    @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .25 } }

    /* 提示：贴右下角的小气泡，短、自动消失，不做横贯长条 */
    .toast {
      position: fixed; right: 18px; bottom: 62px; z-index: 2147483002;
      max-width: 300px; padding: 8px 12px; border-radius: 10px;
      background: rgba(15,20,25,.92); color: #fff; font-size: 12.5px; line-height: 1.45;
      box-shadow: 0 8px 20px rgba(0,0,0,.26); pointer-events: none;
    }
  `;

  const ui = {
    host: null,
    root: null,
    el: {},

    mount() {
      if (this.host) return;
      const host = document.createElement("div");
      host.id = "x-scraper-host";
      document.documentElement.appendChild(host);
      const root = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = CSS;
      root.appendChild(style);

      const panel = document.createElement("div");
      panel.className = "panel";
      panel.innerHTML = `
        <header id="hdr">
          <span class="title">Xtract</span>
          <span class="badge" id="badge">v1.3.0</span>
          <button id="collapse" title="折叠">–</button>
        </header>
        <div class="body">
          <div class="page" id="page">检测页面中…</div>
          <div class="row"><label>目标条数</label><input type="number" id="target" min="10" step="10"></div>
          <div class="row"><label>滚动间隔(ms)</label><input type="number" id="delay" min="300" step="100"></div>
          <div class="checks">
            <label><input type="checkbox" id="autoScroll"> 自动滚动（关闭＝你手动滑，脚本持续记录）</label>
            <label><input type="checkbox" id="withQuoted"> 抓取引用推文正文</label>
            <label><input type="checkbox" id="withMedia"> 抓取图片 / 视频链接</label>
          </div>
          <div class="btns" id="navRow" style="display:none">
            <button class="act" id="goRetweets">打开转帖列表</button>
            <button class="act" id="goQuotes">打开引用列表</button>
          </div>
          <div class="btns">
            <button class="act primary" id="start">开始抓取</button>
            <button class="act danger" id="stop" disabled>暂停</button>
            <button class="act" id="copyPost" style="grid-column: span 2">复制正文 + 评论（当前帖子）</button>
            <button class="act" id="copyMd">复制 MD</button>
            <button class="act" id="md">导出 MD</button>
            <button class="act" id="json">导出 JSON</button>
            <button class="act" id="csv">导出 CSV</button>
            <button class="act" id="copy">复制 JSON</button>
            <button class="act" id="clear">清空</button>
          </div>
          <div class="status"><span id="count">0 条</span><span id="meta">滚动 0 次</span></div>
          <div class="log" id="log"></div>
          <div class="hint" id="hint"></div>
        </div>`;
      root.appendChild(panel);

      // 收起后显示的悬浮条（点它恢复面板）
      const pill = document.createElement("div");
      pill.id = "pill";
      pill.className = "pill";
      pill.hidden = true;
      pill.innerHTML =
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3z"/>' +
        '<path d="M5 19h14v2H5z"/></svg>' +
        '<span class="dot"></span><span id="pillText"></span>' +
        '<button class="pill-btn" id="pillAuto" title="自动滑动：开/关">⇅</button>' +
        '<button class="pill-btn" id="pillStop" title="暂停抓取">❚❚</button>';
      root.appendChild(pill);

      // 轻量提示，不依赖面板是否展开
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.hidden = true;
      root.appendChild(toast);

      this.host = host;
      this.root = root;
      this.el = {
        panel,
        hdr: root.getElementById("hdr"),
        page: root.getElementById("page"),
        target: root.getElementById("target"),
        delay: root.getElementById("delay"),
        autoScroll: root.getElementById("autoScroll"),
        withQuoted: root.getElementById("withQuoted"),
        withMedia: root.getElementById("withMedia"),
        navRow: root.getElementById("navRow"),
        goRetweets: root.getElementById("goRetweets"),
        goQuotes: root.getElementById("goQuotes"),
        start: root.getElementById("start"),
        stop: root.getElementById("stop"),
        copyPost: root.getElementById("copyPost"),
        json: root.getElementById("json"),
        csv: root.getElementById("csv"),
        md: root.getElementById("md"),
        copy: root.getElementById("copy"),
        copyMd: root.getElementById("copyMd"),
        clear: root.getElementById("clear"),
        count: root.getElementById("count"),
        meta: root.getElementById("meta"),
        log: root.getElementById("log"),
        hint: root.getElementById("hint"),
        collapse: root.getElementById("collapse"),
        pill,
        pillText: pill.querySelector("#pillText"),
        pillStop: pill.querySelector("#pillStop"),
        pillAuto: pill.querySelector("#pillAuto"),
        toast,
      };

      this.bind();
      this.syncInputs();
      this.render();
      this.detectTheme();
      // 恢复上次的面板状态（默认收起，避免刷新后又糊在页面上）
      this.setCollapsed(opts.collapsed !== false);
    },

    detectTheme() {
      const dark =
        document.documentElement.style.backgroundColor.includes("0, 0, 0") ||
        getComputedStyle(document.body).backgroundColor === "rgb(0, 0, 0)";
      this.el.panel.classList.toggle("dark", dark);
    },

    bind() {
      const el = this.el;
      el.start.addEventListener("click", () => start());
      el.stop.addEventListener("click", () => stop("手动停止"));

      const jump = (suffix) => {
        const info = pageInfo();
        if (info.id) location.href = `/${info.handle}/status/${info.id}/${suffix}`;
      };
      el.goRetweets.addEventListener("click", () => jump("retweets"));
      el.goQuotes.addEventListener("click", () => jump("quotes"));
      el.json.addEventListener("click", exportJSON);
      el.csv.addEventListener("click", exportCSV);
      el.md.addEventListener("click", exportMD);
      el.copyPost.addEventListener("click", copyPost);
      el.copy.addEventListener("click", copyJSON);
      el.copyMd.addEventListener("click", copyMD);

      el.clear.addEventListener("click", () => {
        if (!state.records.size) return;
        if (!confirm(`确定清空已抓取的 ${state.records.size} 条数据？`)) return;
        state.records.clear();
        this.log("已清空");
        this.render();
      });

      el.collapse.addEventListener("click", () => {
        this.setCollapsed(!el.panel.classList.contains("collapsed"));
      });
      el.pill.addEventListener("click", (e) => {
        if (e.target && e.target.id === "pillStop") return;
        this.setCollapsed(false);
      });
      el.pillStop.addEventListener("click", (e) => {
        e.stopPropagation();
        stop("手动暂停");
      });
      el.pillAuto.addEventListener("click", (e) => {
        e.stopPropagation();
        opts.autoScroll = !opts.autoScroll;
        saveSettings();
        el.autoScroll.checked = opts.autoScroll;
        ui.toast(opts.autoScroll ? "已开启自动滑动" : "已关闭自动滑动（你手动滑）", 1800);
        ui.render();
      });

      el.target.addEventListener("change", () => {
        opts.target = Math.max(10, Number(el.target.value) || DEFAULTS.target);
        el.target.value = opts.target;
        saveSettings();
      });
      el.delay.addEventListener("change", () => {
        opts.delay = Math.max(300, Number(el.delay.value) || DEFAULTS.delay);
        el.delay.value = opts.delay;
        saveSettings();
      });
      for (const key of ["autoScroll", "withQuoted", "withMedia"]) {
        el[key].addEventListener("change", () => {
          opts[key] = el[key].checked;
          saveSettings();
        });
      }

      // 拖动
      let dragging = null;
      el.hdr.addEventListener("mousedown", (e) => {
        if (e.target.tagName === "BUTTON") return;
        const rect = el.panel.getBoundingClientRect();
        dragging = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        e.preventDefault();
      });
      window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        el.panel.style.left = `${Math.max(0, e.clientX - dragging.x)}px`;
        el.panel.style.top = `${Math.max(0, e.clientY - dragging.y)}px`;
        el.panel.style.right = "auto";
      });
      window.addEventListener("mouseup", () => (dragging = null));

      // Esc 停止
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && state.running) stop("按 Esc 暂停");
        // Alt+X 随时唤出/收起面板，防止找不到入口
        if (e.altKey && (e.key === "x" || e.key === "X")) {
          e.preventDefault();
          ui.setCollapsed(!ui.el.panel.classList.contains("collapsed"));
        }
      });
    },

    syncInputs() {
      const el = this.el;
      el.target.value = opts.target;
      el.delay.value = opts.delay;
      el.autoScroll.checked = opts.autoScroll;
      el.withQuoted.checked = opts.withQuoted;
      el.withMedia.checked = opts.withMedia;
    },

    /** 轻量提示：不依赖面板是否展开 */
    toast(msg, ms = 2200) {
      const el = this.el.toast;
      if (!el) return;
      el.textContent = msg;
      el.hidden = false;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        el.hidden = true;
      }, ms);
    },

    /** 收起 / 展开面板；收起后留一个悬浮条显示进度，状态会记住 */
    setCollapsed(collapsed) {
      this.el.panel.classList.toggle("collapsed", collapsed);
      this.el.collapse.textContent = collapsed ? "+" : "–";
      opts.collapsed = collapsed;
      saveSettings();
      this.updatePill();
    },

    updatePill() {
      if (!this.el.pill) return;
      const n = state.records.size;
      const solo = !state.running && n === 0; // 空闲且无数据：只留小圆点
      this.el.pill.classList.toggle("solo", solo);
      this.el.pill.classList.toggle("working", state.running);
      this.el.pill.classList.toggle("idle", !state.running && !solo);
      this.el.pillText.textContent = state.running ? `抓取中 ${n}` : `已抓 ${n}`;
      this.el.pill.title = state.running
        ? `抓取中 ${n} 条 · 点 ❚❚ 暂停，点空白处展开`
        : n > 0
          ? `已抓 ${n} 条 · 点击展开面板`
          : "Xtract · 点击展开（Alt+X）";
      if (this.el.pillStop) this.el.pillStop.hidden = !state.running;
      if (this.el.pillAuto) {
        this.el.pillAuto.hidden = !state.running;
        this.el.pillAuto.title = opts.autoScroll ? "自动滑动：开（点一下关闭）" : "自动滑动：关（点一下开启）";
      }
      // 收起状态一律留入口，否则没法再打开面板
      this.el.pill.hidden = !this.el.panel.classList.contains("collapsed");
    },

    log(msg) {
      const line = document.createElement("div");
      const t = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      line.textContent = `[${t}] ${msg}`;
      this.el.log.prepend(line);
      while (this.el.log.childElementCount > 40) this.el.log.lastElementChild.remove();
    },

    render() {
      if (!this.el.panel) return;
      this.detectTheme();
      const info = pageInfo();
      this.el.page.textContent = `当前页面：${describePage(info)}`;

      let hint = "";
      if (info.kind === "status") {
        hint =
          "这是帖子详情页。要看「谁转帖了」或「哪些引用」，打开下方对应页面后再点开始抓取。";
      } else if (info.kind === "retweets") {
        hint = "转帖列表页：抓取的是转帖该帖的用户（账号 / 昵称 / 简介）。";
      } else if (info.kind === "quotes") {
        hint = "引用列表页：抓取的是引用了该帖的推文及其正文。";
      } else if (info.kind === "profile") {
        hint = "主页：抓取时间线上所有帖子，包含置顶与转帖（可在数据里按 social_context 区分）。";
      } else {
        hint = "请打开用户主页、帖子详情、转帖列表或引用列表页。";
      }
      if (info.kind !== "other") {
        hint += "\n流程：开始 → 手动下滑 → 暂停 → 复制 MD";
      }
      this.el.hint.textContent = hint;

      this.el.navRow.style.display = info.kind === "status" ? "grid" : "none";

      this.el.count.textContent = `${state.records.size} 条`;
      this.el.meta.textContent = `滚动 ${state.scrolls} 次`;
      // 任何页面都允许点击，点了给明确提示，而不是按钮悄悄失效
      this.el.start.disabled = state.running;
      this.el.stop.disabled = !state.running;
      this.updatePill();
    },
  };

  /* ============================================================
   * 7. 启动
   * ============================================================ */

  // 调试入口：控制台里可直接单条验证解析结果
  window.__xScraper = {
    state,
    opts,
    pageInfo,
    parseTweet,
    parseUserCell,
    parseCounts,
    collectOnce,
    toMarkdown,
    toCSV,
  };

  loadSettings();
  ui.mount();
  ui.log("已加载，打开主页或帖子页后点「开始抓取」");

  // X 是 SPA，路由变了要刷新页面识别
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (!state.running) ui.render();
    }
  }, 1000);
})();
