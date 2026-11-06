// ==UserScript==
// @name         论坛内容过滤器
// @name:en      Forum Content Filter
// @namespace    https://github.com/lijkop/xxs-userscript-engineer
// @version      1.0.0
// @description  在 Linux.do、V2EX、Reddit 上按标签、关键词与用户名过滤帖子、主帖和回复，支持共享水帖词、可视化面板与规则导入导出。
// @description:zh-CN 在 Linux.do、V2EX、Reddit 上按标签、关键词与用户名过滤帖子、主帖和回复，支持共享水帖词、可视化面板与规则导入导出。
// @description:en Filter posts and replies on Linux.do, V2EX and Reddit by tags, keywords and usernames, with shared reply words, a visual panel and rule import/export.
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/forum-content-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/forum-content-filter.user.js
// @match        https://linux.do/*
// @match        https://*.linux.do/*
// @match        https://v2ex.com/*
// @match        https://www.v2ex.com/*
// @match        https://*.v2ex.com/*
// @match        https://reddit.com/*
// @match        https://www.reddit.com/*
// @license      MIT
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    /* ================= 常量 ================= */

    const SCRIPT_NAME = '论坛内容过滤器';
    const STORAGE_KEY = 'forum-content-filter:config:v1';
    const STYLE_ID = 'fcf-style';
    const HIDDEN_ATTR = 'data-fcf-hidden';
    const REASON_ATTR = 'data-fcf-reason';

    // 共享回复水帖词：Linux.do 与 V2EX 共用，命中即隐藏「回复」（不含主帖）
    const DEFAULT_REPLY_WORDS = [
        '多谢',
        '节日快乐',
        '待我尝尝鲜',
        '谢谢',
        '有用，',
        '有用！',
        '感谢',
        '感谢佬',
        '神了佬',
        '牛逼'
    ];

    // 命中时被移除的引用 / 代码块容器（仅在开启「忽略引用与代码块」时生效）
    const NOISE_SELECTOR = 'blockquote, aside.quote, .quote, pre, code, .cooked-selection-barrier';

    const TITLE_SELECTOR = 'a.title.raw-link.raw-topic-link, a.raw-topic-link, .main-link a.title, a.title';
    const TAG_SELECTOR = '.discourse-tags [data-tag-name], a.discourse-tag[data-tag-name], .discourse-tags a';
    const POST_CONTENT_SELECTOR = '.post__contents .cooked, .topic-body .cooked, .cooked';
    const V2EX_REPLY_SELECTOR = '.reply_content';
    const REDDIT_POST_SELECTOR = 'shreddit-post';
    const REDDIT_COMMENT_SELECTOR = 'shreddit-comment';

    /* ================= 基础工具 ================= */

    /** 统一大小写与全半角后比较，避免「ＡＢＣ」与「abc」漏匹配 */
    function normalize(text) {
        return String(text == null ? '' : text)
            .normalize('NFKC')
            .trim()
            .toLowerCase();
    }

    /** 把数组清洗成去重后的词条列表（保留用户输入的原始写法） */
    function toWords(value) {
        if (!Array.isArray(value)) return [];
        const seen = new Set();
        const words = [];
        value.forEach((item) => {
            const word = String(item == null ? '' : item).trim();
            const key = normalize(word);
            if (!key || seen.has(key)) return;
            seen.add(key);
            words.push(word);
        });
        return words;
    }

    /** 文本里是否命中词条，返回命中的原始词条（未命中返回空串） */
    function matchWord(text, words) {
        const source = normalize(text);
        if (!source || !words || !words.length) return '';
        for (const word of words) {
            const key = normalize(word);
            if (key && source.includes(key)) return word;
        }
        return '';
    }

    /** textarea 内容按行拆词 */
    function toLines(text) {
        return toWords(String(text == null ? '' : text).split(/\r?\n/));
    }

    /** 遍历 root 自身及后代中所有匹配节点（去重） */
    function each(root, selector, callback) {
        if (!root) return;
        const nodes = new Set();
        if (root.nodeType === 1 && root.matches && root.matches(selector)) nodes.add(root);
        if (root.querySelectorAll) root.querySelectorAll(selector).forEach((node) => nodes.add(node));
        nodes.forEach(callback);
    }

    function firstNode(root, selector) {
        if (!root || !root.querySelector) return null;
        return root.querySelector(selector);
    }

    function textOf(node) {
        if (!node) return '';
        return String(node.textContent || '').trim();
    }

    /**
     * 取用于匹配的正文：开启「忽略引用与代码块」时先克隆再剔除噪声块，
     * 避免因为引用里的「感谢」把正常回复误伤。
     */
    function cleanText(node) {
        if (!node) return '';
        if (!config.ignoreQuoteAndCode) return textOf(node);
        const clone = node.cloneNode(true);
        clone.querySelectorAll(NOISE_SELECTOR).forEach((noise) => noise.remove());
        return textOf(clone);
    }

    /**
     * 统一打标记：用属性而不是 class 隐藏。
     * Discourse / Reddit 会重写节点 class，属性标记不会被框架覆盖。
     */
    function mark(element, reason) {
        if (!element || element.nodeType !== 1) return;
        if (!reason) {
            if (element.hasAttribute(HIDDEN_ATTR)) element.removeAttribute(HIDDEN_ATTR);
            if (element.hasAttribute(REASON_ATTR)) element.removeAttribute(REASON_ATTR);
            return;
        }
        if (element.getAttribute(HIDDEN_ATTR) !== '1') element.setAttribute(HIDDEN_ATTR, '1');
        if (element.getAttribute(REASON_ATTR) !== reason) element.setAttribute(REASON_ATTR, reason);
    }

    function clearMarks() {
        document.querySelectorAll('[' + HIDDEN_ATTR + ']').forEach((element) => mark(element, ''));
    }

    /* ================= 配置 ================= */

    function defaultConfig() {
        return {
            enabled: true,
            ignoreQuoteAndCode: true,
            replyKeywords: DEFAULT_REPLY_WORDS.slice(),
            sites: {
                linuxdo: {
                    enabled: true,
                    tags: [],
                    titleKeywords: [],
                    mainPostKeywords: [],
                    replyEnabled: true
                },
                v2ex: {
                    enabled: true,
                    replyEnabled: true
                },
                reddit: {
                    enabled: true,
                    keywords: [],
                    users: []
                }
            }
        };
    }

    /**
     * 把任意来源的数据整理成完整配置。
     * 兼容旧版 Reddit 屏蔽器的规则格式 { users: [], keywords: [] }。
     */
    function normalizeConfig(data) {
        const next = defaultConfig();
        if (!data || typeof data !== 'object') return next;

        if (!data.sites && (Array.isArray(data.users) || Array.isArray(data.keywords))) {
            next.sites.reddit.users = toWords(data.users);
            next.sites.reddit.keywords = toWords(data.keywords);
            return next;
        }

        next.enabled = data.enabled !== false;
        next.ignoreQuoteAndCode = data.ignoreQuoteAndCode !== false;
        if (Array.isArray(data.replyKeywords)) next.replyKeywords = toWords(data.replyKeywords);

        const sites = data.sites && typeof data.sites === 'object' ? data.sites : {};
        for (const site of SITES) {
            const source = sites[site.key];
            if (!source || typeof source !== 'object') continue;
            const target = next.sites[site.key];
            for (const field of site.fields) {
                if (field.type === 'bool') target[field.key] = source[field.key] !== false;
                else if (Array.isArray(source[field.key])) target[field.key] = toWords(source[field.key]);
            }
        }
        return next;
    }

    function storageGet(key, fallback) {
        try {
            if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
        } catch (error) {
            console.warn('[' + SCRIPT_NAME + '] GM_getValue 不可用', error);
        }
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function storageSet(key, value) {
        let saved = false;
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(key, value);
                saved = true;
            }
        } catch (error) {
            console.warn('[' + SCRIPT_NAME + '] GM_setValue 不可用', error);
        }
        if (!saved) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error('[' + SCRIPT_NAME + '] 配置保存失败', error);
            }
        }
    }

    let config = defaultConfig();

    function loadConfig() {
        return normalizeConfig(storageGet(STORAGE_KEY, null));
    }

    function persist() {
        storageSet(STORAGE_KEY, config);
    }

    /* ================= 站点适配器 =================
     * 新增论坛只需要三处改动：
     * 1. 文件头加 @match；
     * 2. 在 SITES 里加一个适配器：fields 声明面板字段，scan 负责打标记；
     * 3. 在 defaultConfig().sites 和 hasRules() 里补上默认值与「有规则才扫描」判断。
     */

    const SITES = [
        {
            key: 'linuxdo',
            label: 'Linux.do',
            fields: [
                { key: 'enabled', label: '启用 Linux.do 过滤', type: 'bool' },
                { key: 'tags', label: '屏蔽标签', type: 'list', rows: 3, hint: '标签完全一致才隐藏，每行一个' },
                { key: 'titleKeywords', label: '屏蔽标题关键词', type: 'list', rows: 3, hint: '命中标题即隐藏整条列表项' },
                { key: 'mainPostKeywords', label: '屏蔽主帖关键词', type: 'list', rows: 3, hint: '仅作用于 1 楼正文' },
                { key: 'replyEnabled', label: '过滤回复（使用上面的共享水帖词）', type: 'bool' }
            ],
            scan(root, siteConfig) {
                each(root, 'tr.topic-list-item', (row) => {
                    let reason = '';
                    if (siteConfig.enabled) {
                        const title = firstNode(row, TITLE_SELECTOR);
                        const titleHit = matchWord(textOf(title || row), siteConfig.titleKeywords);
                        if (titleHit) {
                            reason = '标题：' + titleHit;
                        } else {
                            const tagHit = matchTag(row, siteConfig.tags);
                            if (tagHit) reason = '标签：' + tagHit;
                        }
                    }
                    mark(row, reason);
                });

                each(root, '.topic-post[data-post-number]', (post) => {
                    const number = parseInt(post.getAttribute('data-post-number'), 10) || 0;
                    const content = firstNode(post, POST_CONTENT_SELECTOR);
                    let reason = '';
                    if (siteConfig.enabled && content) {
                        const text = cleanText(content);
                        if (number === 1) {
                            const hit = matchWord(text, siteConfig.mainPostKeywords);
                            if (hit) reason = '主帖：' + hit;
                        } else if (number > 1 && siteConfig.replyEnabled) {
                            const hit = matchWord(text, config.replyKeywords);
                            if (hit) reason = '回复：' + hit;
                        }
                    }
                    mark(post, reason);
                });
            }
        },
        {
            key: 'v2ex',
            label: 'V2EX',
            fields: [
                { key: 'enabled', label: '启用 V2EX 过滤', type: 'bool' },
                { key: 'replyEnabled', label: '过滤回复（使用上面的共享水帖词）', type: 'bool' }
            ],
            scan(root, siteConfig) {
                if (!siteConfig.enabled || !siteConfig.replyEnabled) {
                    each(root, V2EX_REPLY_SELECTOR, (content) => mark(v2exHolder(content), ''));
                    return;
                }
                each(root, V2EX_REPLY_SELECTOR, (content) => {
                    const hit = matchWord(cleanText(content), config.replyKeywords);
                    mark(v2exHolder(content), hit ? '回复：' + hit : '');
                });
            }
        },
        {
            key: 'reddit',
            label: 'Reddit',
            fields: [
                { key: 'enabled', label: '启用 Reddit 过滤', type: 'bool' },
                { key: 'keywords', label: '屏蔽关键词', type: 'list', rows: 4, hint: '作用于帖子标题与评论正文，每行一个' },
                { key: 'users', label: '屏蔽用户名', type: 'list', rows: 4, hint: '不带 u/ 前缀，每行一个' }
            ],
            scan(root, siteConfig) {
                const users = new Set(siteConfig.users.map(redditUser));
                const active = siteConfig.enabled;
                each(root, REDDIT_POST_SELECTOR, (post) => {
                    let reason = '';
                    if (active) {
                        const author = redditUser(post.getAttribute('author'));
                        if (author && users.has(author)) {
                            reason = '用户：' + author;
                        } else {
                            const hit = matchWord(textOf(firstNode(post, '[slot="title"]')), siteConfig.keywords);
                            if (hit) reason = '关键词：' + hit;
                        }
                    }
                    mark(post, reason);
                });
                each(root, REDDIT_COMMENT_SELECTOR, (comment) => {
                    let reason = '';
                    if (active) {
                        const author = redditUser(comment.getAttribute('author'));
                        if (author && users.has(author)) {
                            reason = '用户：' + author;
                        } else {
                            const hit = matchWord(cleanText(firstNode(comment, 'div[slot="comment"]')), siteConfig.keywords);
                            if (hit) reason = '关键词：' + hit;
                        }
                    }
                    mark(comment, reason);
                });
            }
        }
    ];

    function matchTag(row, tags) {
        if (!tags || !tags.length) return '';
        const wanted = new Set(tags.map(normalize));
        const elements = row.querySelectorAll(TAG_SELECTOR);
        for (const element of elements) {
            const candidates = [element.getAttribute('data-tag-name'), textOf(element)];
            for (const candidate of candidates) {
                const key = normalize(candidate);
                if (key && wanted.has(key)) return candidate;
            }
        }
        return '';
    }

    function v2exHolder(content) {
        return content.closest('.cell, .comment') || content.parentElement;
    }

    function redditUser(value) {
        return normalize(String(value || '').replace(/^u\//i, ''));
    }

    function currentSite() {
        const host = location.hostname.toLowerCase();
        if (host === 'linux.do' || host.endsWith('.linux.do')) return SITES[0];
        if (host === 'v2ex.com' || host.endsWith('.v2ex.com')) return SITES[1];
        if (host === 'reddit.com' || host.endsWith('.reddit.com')) return SITES[2];
        return null;
    }

    /** 当前站点是否还有生效规则，没有就跳过扫描（省开销，也顺手清掉旧标记） */
    function hasRules(site, siteConfig) {
        if (!config.enabled || !siteConfig || siteConfig.enabled === false) return false;
        if (!siteConfig.enabled) return false;
        if (site.key === 'linuxdo') {
            return Boolean(
                siteConfig.tags.length ||
                siteConfig.titleKeywords.length ||
                siteConfig.mainPostKeywords.length ||
                (siteConfig.replyEnabled && config.replyKeywords.length)
            );
        }
        if (site.key === 'v2ex') return Boolean(siteConfig.replyEnabled && config.replyKeywords.length);
        if (site.key === 'reddit') return Boolean(siteConfig.keywords.length || siteConfig.users.length);
        return false;
    }

    /* ================= 扫描 ================= */

    function scan(root) {
        const scope = root || document;
        try {
            if (!config.enabled) {
                if (document.querySelector('[' + HIDDEN_ATTR + ']')) clearMarks();
                updateBadge();
                return;
            }
            const site = currentSite();
            if (!site) return;
            const siteConfig = config.sites[site.key];
            if (!hasRules(site, siteConfig)) {
                if (document.querySelector('[' + HIDDEN_ATTR + ']')) clearMarks();
            } else {
                site.scan(scope, siteConfig);
            }
        } catch (error) {
            console.error('[' + SCRIPT_NAME + '] 扫描失败', error);
        }
        updateBadge();
    }

    /* ================= 界面 ================= */

    const CSS = `
:root {
  --fcf-bg: #ffffff;
  --fcf-fg: #1f2328;
  --fcf-border: rgba(128, 128, 128, .28);
  --fcf-muted: rgba(128, 128, 128, .1);
  --fcf-primary: #2f6feb;
  --fcf-primary-hover: #2559c4;
  --fcf-danger: #c0392b;
  --fcf-badge: #d35400;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fcf-bg: #1c1f24;
    --fcf-fg: #e6e6e6;
    --fcf-border: rgba(255, 255, 255, .18);
    --fcf-muted: rgba(255, 255, 255, .08);
  }
}
#fcf-open {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
  min-height: 38px; padding: 8px 16px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--fcf-border);
  background: var(--fcf-bg); color: var(--fcf-fg);
  font: 600 14px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  box-shadow: 0 4px 16px rgba(0, 0, 0, .18);
  transition: opacity .15s ease, transform .15s ease;
  user-select: none;
}
#fcf-open:hover { transform: scale(1.03); }
#fcf-open.fcf-has-items { border-color: var(--fcf-badge); color: var(--fcf-badge); }
#fcf-overlay {
  position: fixed; inset: 0; z-index: 2147483001; display: none;
  align-items: center; justify-content: center; padding: 16px;
  background: rgba(0, 0, 0, .45);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
}
#fcf-overlay.fcf-visible { display: flex; }
#fcf-overlay * { box-sizing: border-box; }
#fcf-panel {
  position: relative;
  display: flex; flex-direction: column; width: min(580px, 100%);
  max-height: min(84vh, 780px); overflow: hidden;
  border-radius: 14px; background: var(--fcf-bg); color: var(--fcf-fg);
  border: 1px solid var(--fcf-border);
  box-shadow: 0 18px 50px rgba(0, 0, 0, .35);
}
#fcf-panel .fcf-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--fcf-border);
}
#fcf-panel .fcf-title { font-size: 16px; font-weight: 700; }
#fcf-panel .fcf-close {
  border: 0; background: transparent; cursor: pointer;
  font-size: 24px; line-height: 1; color: inherit; opacity: .65; padding: 4px 8px;
  border-radius: 6px;
}
#fcf-panel .fcf-close:hover { opacity: 1; background: var(--fcf-muted); }
#fcf-panel .fcf-body { padding: 16px; overflow-y: auto; }
#fcf-panel .fcf-row { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 14px; }
#fcf-panel .fcf-check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
#fcf-panel .fcf-check input { width: 16px; height: 16px; margin: 0; }
#fcf-panel .fcf-status {
  margin: 10px 0 6px; padding: 8px 12px; border-radius: 8px;
  background: var(--fcf-muted); font-size: 13px; opacity: .9;
}
#fcf-panel .fcf-section { margin-top: 16px; }
#fcf-panel .fcf-section-title {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 14px; margin-bottom: 8px;
}
#fcf-panel .fcf-hint { margin: 0 0 8px; font-size: 13px; opacity: .7; line-height: 1.4; }
#fcf-panel .fcf-field { display: block; margin-top: 12px; }
#fcf-panel .fcf-field > span { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
#fcf-panel textarea {
  width: 100%; resize: vertical; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--fcf-border); background: var(--fcf-muted);
  color: inherit; font: 13px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
}
#fcf-panel textarea:focus { outline: 2px solid rgba(64, 132, 255, .55); outline-offset: 1px; }
#fcf-panel details.fcf-site {
  margin-top: 12px; border: 1px solid var(--fcf-border); border-radius: 10px;
}
#fcf-panel details.fcf-site > summary {
  padding: 10px 14px; cursor: pointer; font-weight: 600; font-size: 14px; list-style: none;
}
#fcf-panel details.fcf-site > summary::-webkit-details-marker { display: none; }
#fcf-panel details.fcf-site[open] > summary { border-bottom: 1px solid var(--fcf-border); }
#fcf-panel .fcf-site-body { padding: 12px 14px 14px; }
#fcf-panel .fcf-foot {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--fcf-border);
}
#fcf-panel .fcf-btn {
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;
  border: 1px solid var(--fcf-border); background: transparent; color: inherit;
  transition: background .12s ease;
}
#fcf-panel .fcf-btn:hover { background: var(--fcf-muted); }
#fcf-panel .fcf-primary { background: var(--fcf-primary); border-color: var(--fcf-primary); color: #fff; }
#fcf-panel .fcf-primary:hover { background: var(--fcf-primary-hover); }
#fcf-panel .fcf-danger { color: var(--fcf-danger); border-color: rgba(192, 57, 43, .5); }
#fcf-panel .fcf-danger:hover { background: rgba(192, 57, 43, .1); }
#fcf-panel .fcf-toast {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  padding: 8px 16px; border-radius: 999px; background: rgba(20, 22, 26, .94); color: #fff;
  font-size: 13px; opacity: 0; pointer-events: none; transition: opacity .2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, .25);
}
#fcf-panel .fcf-toast.fcf-show { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  #fcf-open, #fcf-panel .fcf-btn, #fcf-panel .fcf-toast { transition: none !important; transform: none !important; }
}
[${HIDDEN_ATTR}="1"] { display: none !important; }
`;

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    let toastTimer = 0;

    function toast(text) {
        const element = document.getElementById('fcf-toast');
        if (!element) return;
        element.textContent = text;
        element.classList.add('fcf-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => element.classList.remove('fcf-show'), 1800);
    }

    function fieldHtml(site, field) {
        const attrs = 'data-fcf-site="' + site.key + '" data-fcf-key="' + field.key + '"';
        if (field.type === 'bool') {
            return '<label class="fcf-check" style="margin-top:10px">' +
                '<input type="checkbox" ' + attrs + '> ' + field.label + '</label>';
        }
        return '<label class="fcf-field"><span>' + field.label + '</span>' +
            (field.hint ? '<p class="fcf-hint">' + field.hint + '</p>' : '') +
            '<textarea rows="' + (field.rows || 3) + '" spellcheck="false" placeholder="每行一个" ' + attrs + '></textarea>' +
            '</label>';
    }

    function siteSectionHtml(site) {
        const fields = site.fields.map((field) => fieldHtml(site, field)).join('');
        return '<details class="fcf-site" data-fcf-section="' + site.key + '">' +
            '<summary>' + site.label + '</summary>' +
            '<div class="fcf-site-body">' + fields + '</div>' +
            '</details>';
    }

    function buildPanel() {
        if (document.getElementById('fcf-open') || !document.body) return;

        const openButton = document.createElement('button');
        openButton.id = 'fcf-open';
        openButton.type = 'button';
        openButton.title = '打开论坛内容过滤器设置';
        openButton.textContent = '过滤设置';
        openButton.addEventListener('click', openPanel);

        const overlay = document.createElement('div');
        overlay.id = 'fcf-overlay';
        overlay.innerHTML =
            '<div id="fcf-panel" role="dialog" aria-modal="true" aria-label="论坛内容过滤器">' +
                '<div class="fcf-head">' +
                    '<div class="fcf-title">论坛内容过滤器</div>' +
                    '<button id="fcf-close" type="button" class="fcf-close" aria-label="关闭">×</button>' +
                '</div>' +
                '<div class="fcf-body">' +
                    '<div class="fcf-row">' +
                        '<label class="fcf-check"><input type="checkbox" id="fcf-enabled"> 启用过滤</label>' +
                        '<label class="fcf-check"><input type="checkbox" id="fcf-ignore-quote"> 忽略引用与代码块</label>' +
                    '</div>' +
                    '<div class="fcf-status" id="fcf-status"></div>' +
                    '<section class="fcf-section">' +
                        '<div class="fcf-section-title">共享回复水帖词 <span class="fcf-hint">Linux.do / V2EX</span></div>' +
                        '<p class="fcf-hint">命中即隐藏「回复」，主帖不受影响；每行一个，清空则不过滤回复。</p>' +
                        '<textarea id="fcf-reply-words" rows="5" spellcheck="false"></textarea>' +
                    '</section>' +
                    '<div id="fcf-sites">' + SITES.map(siteSectionHtml).join('') + '</div>' +
                '</div>' +
                '<div class="fcf-foot">' +
                    '<button id="fcf-save" type="button" class="fcf-btn fcf-primary">保存并应用</button>' +
                    '<button id="fcf-io" type="button" class="fcf-btn">导入 / 导出</button>' +
                    '<button id="fcf-reset" type="button" class="fcf-btn fcf-danger">恢复默认</button>' +
                '</div>' +
                '<div id="fcf-toast" class="fcf-toast"></div>' +
            '</div>';

        document.body.append(openButton, overlay);
        bindPanelEvents(overlay);
    }

    function bindPanelEvents(overlay) {
        const close = document.getElementById('fcf-close');
        if (close) close.addEventListener('click', closePanel);

        const save = document.getElementById('fcf-save');
        if (save) save.addEventListener('click', savePanel);

        const io = document.getElementById('fcf-io');
        if (io) io.addEventListener('click', importExport);

        const reset = document.getElementById('fcf-reset');
        if (reset) reset.addEventListener('click', resetConfig);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closePanel();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closePanel();
        });
    }

    function panelField(siteKey, fieldKey) {
        return document.querySelector('[data-fcf-site="' + siteKey + '"][data-fcf-key="' + fieldKey + '"]');
    }

    function fillPanel() {
        const enabled = document.getElementById('fcf-enabled');
        if (!enabled) return;
        enabled.checked = config.enabled;
        document.getElementById('fcf-ignore-quote').checked = config.ignoreQuoteAndCode;
        document.getElementById('fcf-reply-words').value = config.replyKeywords.join('\n');

        SITES.forEach((site) => {
            const siteConfig = config.sites[site.key] || {};
            site.fields.forEach((field) => {
                const input = panelField(site.key, field.key);
                if (!input) return;
                const value = siteConfig[field.key];
                if (field.type === 'bool') input.checked = value !== false;
                else input.value = Array.isArray(value) ? value.join('\n') : '';
            });
        });
        updateStatus();
    }

    function readPanel() {
        const next = JSON.parse(JSON.stringify(config));
        next.enabled = document.getElementById('fcf-enabled').checked;
        next.ignoreQuoteAndCode = document.getElementById('fcf-ignore-quote').checked;
        next.replyKeywords = toLines(document.getElementById('fcf-reply-words').value);

        SITES.forEach((site) => {
            if (!next.sites[site.key]) next.sites[site.key] = {};
            const target = next.sites[site.key];
            site.fields.forEach((field) => {
                const input = panelField(site.key, field.key);
                if (!input) return;
                target[field.key] = field.type === 'bool' ? input.checked : toLines(input.value);
            });
        });
        return next;
    }

    function savePanel() {
        config = readPanel();
        persist();
        rescanEverything();
        fillPanel();
        toast('过滤设置已保存');
    }

    function resetConfig() {
        if (!window.confirm('恢复默认设置？当前所有屏蔽词会被清空。')) return;
        config = defaultConfig();
        persist();
        rescanEverything();
        fillPanel();
        toast('已恢复默认');
    }

    function importExport() {
        const answer = window.prompt(
            '导出：输入 E 后回车，配置会复制到剪贴板。\n导入：粘贴配置 JSON 后回车。',
            ''
        );
        if (answer === null) return;
        const text = answer.trim();
        if (!text) return;

        if (text.toUpperCase() === 'E') {
            exportConfig();
            return;
        }
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch (error) {
            toast('JSON 格式错误，导入已取消');
            return;
        }
        config = normalizeConfig(parsed);
        persist();
        rescanEverything();
        fillPanel();
        toast('配置已导入');
    }

    function exportConfig() {
        const json = JSON.stringify(config, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(
                () => toast('配置已复制到剪贴板'),
                () => window.prompt('请手动复制以下配置：', json)
            );
            return;
        }
        window.prompt('请手动复制以下配置：', json);
    }

    function openPanel() {
        buildPanel();
        const overlay = document.getElementById('fcf-overlay');
        if (!overlay) return;
        fillPanel();
        overlay.classList.add('fcf-visible');
        const site = currentSite();
        if (site) {
            const section = document.querySelector('[data-fcf-section="' + site.key + '"]');
            if (section) section.setAttribute('open', '');
        }
        updateStatus();
    }

    function closePanel() {
        const overlay = document.getElementById('fcf-overlay');
        if (overlay) overlay.classList.remove('fcf-visible');
    }

    function updateStatus() {
        const element = document.getElementById('fcf-status');
        if (!element) return;
        const site = currentSite();
        const hidden = document.querySelectorAll('[' + HIDDEN_ATTR + '="1"]').length;
        if (!site) {
            element.textContent = '当前站点未适配，可参考文档「新增论坛」接入';
            return;
        }
        element.textContent = '当前站点：' + site.label + ' · 已隐藏 ' + hidden + ' 条';
    }

    function updateBadge() {
        const button = document.getElementById('fcf-open');
        if (!button) return;
        const hidden = document.querySelectorAll('[' + HIDDEN_ATTR + '="1"]').length;
        const label = hidden ? '过滤 ' + hidden : '过滤设置';
        if (button.textContent !== label) button.textContent = label;
        button.classList.toggle('fcf-has-items', hidden > 0);
        const overlay = document.getElementById('fcf-overlay');
        if (overlay && overlay.classList.contains('fcf-visible')) updateStatus();
    }

    /* ================= 调度 ================= */

    let scanTimer = 0;

    function scheduleScan(delay) {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => scan(document), delay == null ? 120 : delay);
    }

    function rescanEverything() {
        clearMarks();
        scan(document);
    }

    function insideUi(node) {
        const element = node && node.nodeType === 1 ? node : node && node.parentElement;
        return Boolean(element && element.closest && element.closest('#fcf-overlay, #fcf-open'));
    }

    function startObserver() {
        const observer = new MutationObserver((records) => {
            const relevant = records.some((record) => !insideUi(record.target));
            if (relevant) scheduleScan(120);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function watchLocation() {
        let current = location.href;
        setInterval(() => {
            if (location.href === current) return;
            current = location.href;
            clearMarks();
            setTimeout(() => scan(document), 80);
            setTimeout(() => scan(document), 400);
        }, 400);
    }

    function registerMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        try {
            GM_registerMenuCommand('打开过滤设置', openPanel);
            GM_registerMenuCommand('启用 / 停用过滤', () => {
                config.enabled = !config.enabled;
                persist();
                rescanEverything();
                toast(config.enabled ? '过滤已启用' : '过滤已停用');
            });
        } catch (error) {
            console.warn('[' + SCRIPT_NAME + '] 菜单注册失败', error);
        }
    }

    function start() {
        ensureStyle();
        buildPanel();
        startObserver();
        watchLocation();
        setInterval(() => scan(document), 1500);
        scan(document);
    }

    function whenBodyReady(callback) {
        if (document.body) {
            callback();
            return;
        }
        const observer = new MutationObserver(() => {
            if (!document.body) return;
            observer.disconnect();
            callback();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    ensureStyle();
    config = loadConfig();
    registerMenu();
    whenBodyReady(start);
})();
