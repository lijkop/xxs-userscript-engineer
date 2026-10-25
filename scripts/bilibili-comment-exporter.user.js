// ==UserScript==
// @name         B站评论批量导出
// @name:en      Bilibili Comment Exporter
// @namespace    https://www.bilibili.com/
// @version      1.1.0
// @description  一键抓取B站视频/动态/番剧评论区，穿透 Lit Web Components 的 Shadow DOM，导出为 Markdown / JSON / CSV，支持自动滚动采集、楼中楼层级、暂停续抓。
// @description:zh-CN 一键抓取B站视频/动态/番剧评论区，穿透 Lit Web Components 的 Shadow DOM，导出为 Markdown / JSON / CSV，支持自动滚动采集、楼中楼层级、暂停续抓。
// @description:en One-click export of Bilibili comments (video/dynamic/bangumi) with Shadow DOM piercing, Markdown/JSON/CSV output, auto-scroll collection and nested reply support.
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/bilibili-comment-exporter.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/bilibili-comment-exporter.user.js
// @match        https://*.bilibili.com/video/*
// @match        https://*.bilibili.com/bangumi/play/*
// @match        https://*.bilibili.com/opus/*
// @match        https://*.bilibili.com/read/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    /* ============================================================
     * 0. 结构说明（证据来源，务必先读）
     * ------------------------------------------------------------
     * B站评论区是 Lit Web Components，评论内容在 shadowRoot 里，
     * 页面源码 / F12 另存 / 普通 querySelector 全部取不到。
     *
     * 已确认（2026-10-25 用户提供的运行时 DOM）：
     *   <bili-comments>
     *     #shadow-root
     *       <div id="contents">
     *         <div id="feed">
     *           <bili-comment-thread-renderer> × N   ← 每个是一层楼
     *         <div id="reply-commentbox">
     *           <bili-comment-box>
     *
     * 内部结构（2026-10-25 逐层核对真实运行时 DOM）：
     *   bili-comment-thread-renderer.shadowRoot
     *     ├ <bili-comment-renderer id="comment">              主楼
     *     └ <div id="replies"> <bili-comment-replies-renderer>
     *           └ shadowRoot #expander-contents
     *               ├ <bili-comment-reply-renderer> × N       楼中楼（默认只渲染 2 条）
     *               └ #expander-footer #view-more bili-text-button  「共 N 条回复，点击查看」
     *   主楼 bili-comment-renderer.shadowRoot
     *     #body > a#user-avatar + #main
     *       #main ├ #header > bili-comment-user-info → shadowRoot #info > #user-name > a
     *             ├ #content > bili-rich-text → shadowRoot p#contents   正文
     *             └ #footer > bili-comment-action-buttons-renderer → shadowRoot
     *                          #pubdate / #ip / #like > #count / #reply
     *   楼中楼 bili-comment-reply-renderer.shadowRoot
     *     #body > #main ├ bili-comment-user-info + bili-rich-text
     *                   └ #footer > bili-comment-action-buttons-renderer（同上）
     *   要点：楼中楼**没有** bili-comment-renderer 包裹层；时间与点赞数都不在
     *   bili-comment-renderer 自己的 shadowRoot 里，而在 action-buttons 的 shadowRoot 里。
     * ============================================================ */

    const TAG = '[B站评论导出]';
    const VERSION = '1.1.0';

    /* ============================================================
     * 1. 通用工具
     * ============================================================ */
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

    /** 在节点自身 shadowRoot 与子树里按标签名查找（穿透 Shadow DOM） */
    function deepFind(root, tag, maxDepth = 6) {
        if (!root) return null;
        const upper = tag.toUpperCase();
        const queue = [{ node: root, depth: 0 }];
        while (queue.length) {
            const { node, depth } = queue.shift();
            if (node.nodeType !== 1 && node.nodeType !== 11) continue;
            if (node.nodeType === 1 && node.tagName === upper) return node;
            if (node.matches && node.matches(tag)) return node;
            if (depth >= maxDepth) continue;
            if (node.shadowRoot) queue.push({ node: node.shadowRoot, depth: depth + 1 });
            node.querySelectorAll && node.querySelectorAll('*').forEach((el) => {
                if (el.shadowRoot) queue.push({ node: el.shadowRoot, depth: depth + 1 });
            });
            const direct = node.querySelector && node.querySelector(tag);
            if (direct) return direct;
        }
        return null;
    }

    /** 在 root（含 shadowRoot）内查找所有匹配标签 */
    function deepFindAll(root, tag, maxDepth = 6) {
        const out = [];
        const upper = tag.toUpperCase();
        (function rec(node, depth) {
            if (!node || depth > maxDepth) return;
            node.querySelectorAll && node.querySelectorAll('*').forEach((el) => {
                if (el.tagName === upper) out.push(el);
                if (el.shadowRoot) rec(el.shadowRoot, depth + 1);
            });
            node.shadowRoot && rec(node.shadowRoot, depth + 1);
        })(root, 0);
        return out;
    }

    /** 影子查询：root.shadowRoot 优先，再退到自身 */
    function sh(el) {
        return (el && el.shadowRoot) || el || null;
    }

    /** 在元素及其 shadowRoot 里按选择器找第一个（最多下探 2 层 shadow） */
    function q(root, sel, depth = 2) {
        if (!root) return null;
        const direct = root.querySelector && root.querySelector(sel);
        if (direct) return direct;
        if (root.shadowRoot && depth > 0) {
            const inner = root.shadowRoot.querySelector(sel);
            if (inner) return inner;
            for (const el of root.shadowRoot.querySelectorAll('*')) {
                if (el.shadowRoot) {
                    const r = el.shadowRoot.querySelector(sel);
                    if (r) return r;
                }
            }
        }
        return null;
    }

    /** 数字解析：兼容 "1.2万" / "1234" / "999+" */
    function parseNum(s) {
        if (!s) return 0;
        const t = String(s).replace(/\s+/g, '');
        const m = t.match(/([\d.]+)\s*([万wW千kK]?)/);
        if (!m) return 0;
        let n = parseFloat(m[1]);
        if (!isFinite(n)) return 0;
        if (/[万wW]/.test(m[2])) n *= 10000;
        else if (/[千kK]/.test(m[2])) n *= 1000;
        return Math.round(n);
    }

    function pad2(n) { return String(n).padStart(2, '0'); }
    function stamp(d = new Date()) {
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    }
    function fileStamp(d = new Date()) {
        return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    }

    function download(filename, content, mime = 'text/plain;charset=utf-8') {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    /* ============================================================
     * 2. 评论区定位与解析
     * ============================================================ */
    const State = {
        list: [],          // 扁平评论数组
        seen: new Set(),   // 去重键
        running: false,
        paused: false,
        autoScroll: true,
        scanning: false,
        lastUrl: location.href
    };

    function pageMeta() {
        const title = (document.querySelector('h1.video-title, h1[title], .video-title')?.textContent
            || document.title || '').replace(/\s+/g, ' ').trim();
        let type = '视频';
        if (/\/bangumi\/play\//.test(location.pathname)) type = '番剧';
        else if (/\/opus\//.test(location.pathname)) type = '动态';
        else if (/\/read\//.test(location.pathname)) type = '专栏';
        return { title, url: location.href.split('#')[0], type };
    }

    /** 找 bili-comments 宿主（可能在 light DOM，也可能嵌在别的 shadowRoot） */
    let _hostCache = null;
    function findCommentsHost() {
        if (_hostCache && _hostCache.isConnected) return _hostCache;
        _hostCache = null;

        const direct = document.querySelector('bili-comments');
        if (direct) { _hostCache = direct; return direct; }

        // 全页扫描只做一次，结果缓存；SPA 换页时 isConnected 会变 false 自动重找
        for (const el of document.querySelectorAll('*')) {
            if (!el.shadowRoot) continue;
            const h = el.shadowRoot.querySelector('bili-comments');
            if (h) { _hostCache = h; return h; }
        }
        return null;
    }

    function getThreads(host) {
        if (!host) return [];
        const root = sh(host);
        return Array.from(root.querySelectorAll('bili-comment-thread-renderer'));
    }

    /** 正文提取：递归走 DOM，正确处理 表情 / 图片 / @ / 话题 / 换行 */
    function extractRichText(richEl) {
        const images = [];
        let text = '';
        if (!richEl) return { text, images };

        const root = q(richEl, '#contents') || sh(richEl);

        (function walk(node) {
            node.childNodes.forEach((c) => {
                if (c.nodeType === 3) {
                    text += c.nodeValue;
                    return;
                }
                if (c.nodeType !== 1) return;
                const tag = c.tagName;
                if (tag === 'BR') { text += '\n'; return; }
                if (tag === 'IMG') {
                    const alt = (c.getAttribute('alt') || '').trim();
                    const src = c.getAttribute('data-src') || c.getAttribute('src') || '';
                    // B站表情图在 //i0.hdslb.com/bfs/emote/...，alt 形如 [笑哭]
                    const isEmoji = /emoji|emote/i.test(c.className || '')
                        || /bfs\/(emote|emoji)/i.test(src)
                        || /^\[.+\]$/.test(alt);
                    if (isEmoji) {
                        text += alt ? `[${alt}]` : '[表情]';
                    } else if (src) {
                        images.push(src.startsWith('//') ? 'https:' + src : src);
                    }
                    return;
                }
                if (tag === 'A') {
                    const t = (c.textContent || '').replace(/\s+/g, ' ').trim();
                    text += t;
                    return;
                }
                if (tag === 'VIDEO' || tag === 'IFRAME') return;
                walk(c);
            });
        })(root);

        text = text
            .replace(/\u200b/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return { text, images };
    }

    /** 解析一条评论容器
     *  真实结构（2026-10-25 用户提供的运行时 DOM 核对，已实站验证）：
     *    主楼  bili-comment-renderer.shadowRoot
     *            #body > #main > #header > bili-comment-user-info
     *                          > #content > bili-rich-text
     *                          > #footer > bili-comment-action-buttons-renderer
     *    楼中楼 bili-comment-reply-renderer.shadowRoot
     *            #body > #main > bili-comment-user-info + bili-rich-text
     *                          > #footer > bili-comment-action-buttons-renderer
     *  注意：楼中楼没有 bili-comment-renderer 包裹层；时间/点赞/IP 全在
     *  action-buttons 的 shadowRoot 里（#pubdate / #like #count / #ip）
     */
    function parseComment(container, level) {
        if (!container || !container.shadowRoot) return null;
        const r = container.shadowRoot;

        // --- 用户信息 ---
        const userInfo = r.querySelector('bili-comment-user-info');
        const ur = userInfo && userInfo.shadowRoot;
        const nameEl = ur && ur.querySelector('#user-name');
        const nameAnchor = nameEl && nameEl.querySelector('a');
        const name = txt(nameAnchor) || txt(nameEl) || '匿名用户';
        let userLink = (nameAnchor && nameAnchor.getAttribute('href')) || '';
        if (userLink.startsWith('//')) userLink = 'https:' + userLink;
        // UP 主：昵称 a 的内联颜色固定为 #FB7299
        const isUp = /fb7299/i.test((nameAnchor && nameAnchor.getAttribute('style')) || '');

        // --- 正文 ---
        const rich = r.querySelector('bili-rich-text');
        const { text, images } = extractRichText(rich);

        // --- 时间 / 点赞 / IP ---
        const actions = r.querySelector('bili-comment-action-buttons-renderer');
        const ar = actions && actions.shadowRoot;
        const time = txt(ar && ar.querySelector('#pubdate'));
        const ip = txt(ar && ar.querySelector('#ip')).replace(/^IP属地\s*[:：]\s*/, '');
        const like = parseNum(txt(ar && ar.querySelector('#like #count')));
        const replyLabel = txt(ar && ar.querySelector('#reply'));

        const pinned = /置顶/.test(txt(ur && ur.querySelector('#info')));

        if (!text && !images.length) return null;

        return {
            level, name, userLink, isUp, time, ip, like, replyLabel, pinned, text, images
        };
    }

    /** 展开「共 N 条回复，点击查看」——楼中楼默认只渲染前 2 条 */
    async function expandReplies() {
        const host = findCommentsHost();
        if (!host) return 0;
        let clicked = 0;
        getThreads(host).forEach((thread) => {
            const tr = thread.shadowRoot;
            if (!tr) return;
            const rrHost = tr.querySelector('bili-comment-replies-renderer');
            const sr = rrHost && rrHost.shadowRoot;
            if (!sr) return;
            sr.querySelectorAll('#view-more bili-text-button').forEach((btnHost) => {
                const inner = btnHost.shadowRoot && btnHost.shadowRoot.querySelector('button');
                if (inner) { inner.click(); clicked++; }
            });
        });
        if (clicked) await sleep(900);
        return clicked;
    }

    /** 采集当前已渲染的所有评论 */
    function collectOnce() {
        const host = findCommentsHost();
        if (!host) return { added: 0, total: State.list.length, threads: 0 };

        const threads = getThreads(host);
        let added = 0;

        threads.forEach((thread, ti) => {
            const tr = thread.shadowRoot;
            if (!tr) return;

            // 主楼：bili-comment-renderer（thread.shadowRoot 下第一个，id="comment"）
            const main = parseComment(tr.querySelector('bili-comment-renderer'), 0);
            if (main) {
                main.floor = ti + 1;
                const key = `0|${main.name}|${main.time}|${main.text.slice(0, 40)}`;
                if (!State.seen.has(key)) {
                    State.seen.add(key);
                    State.list.push(main);
                    added++;
                }
            }

            // 楼中楼：bili-comment-replies-renderer 的 shadowRoot 里
            const rrHost = tr.querySelector('bili-comment-replies-renderer');
            const rsr = rrHost && rrHost.shadowRoot;
            const replies = rsr ? Array.from(rsr.querySelectorAll('bili-comment-reply-renderer')) : [];

            replies.forEach((rep, ri) => {
                const one = parseComment(rep, 1);
                if (!one) return;
                const key = `1|${one.name}|${one.time}|${one.text.slice(0, 40)}`;
                if (State.seen.has(key)) return;
                State.seen.add(key);
                one.floor = ti + 1;
                one.replyIndex = ri + 1;
                State.list.push(one);
                added++;
            });
        });

        return { added, total: State.list.length, threads: threads.length };
    }

    /* ============================================================
     * 3. 导出
     * ============================================================ */
    function toMarkdown() {
        const meta = pageMeta();
        const mains = State.list.filter((c) => c.level === 0);
        const subs = State.list.filter((c) => c.level === 1);

        const lines = [];
        lines.push(`# ${meta.title || 'B站评论'} — 评论导出`);
        lines.push('');
        lines.push(`- 页面类型：${meta.type}`);
        lines.push(`- 链接：${meta.url}`);
        lines.push(`- 导出时间：${stamp()}`);
        lines.push(`- 评论数：${mains.length} 条主楼 / ${subs.length} 条回复`);
        lines.push(`- 导出工具：B站评论批量导出 v${VERSION}（小小薯 XXS）`);
        lines.push('');
        lines.push('---');
        lines.push('');

        let floor = 0;
        State.list.forEach((c) => {
            if (c.level === 0) {
                floor++;
                lines.push(`## ${floor}. ${c.name}${c.isUp ? '（UP主）' : ''}`);
                const metaLine = [c.time, c.ip ? `IP属地：${c.ip}` : '', c.like ? `${c.like} 赞` : '', c.pinned ? '置顶' : '']
                    .filter(Boolean).join(' · ');
                if (metaLine) lines.push(`> ${metaLine}`);
                if (c.userLink) lines.push(`> 主页：${c.userLink}`);
                lines.push('');
            } else {
                const metaLine = [c.time, c.ip, c.like ? `${c.like} 赞` : '', c.isUp ? 'UP主' : '']
                    .filter(Boolean).join(' · ');
                lines.push(`- **${c.name}**${metaLine ? `（${metaLine}）` : ''}`);
            }

            const indent = c.level === 0 ? '' : '  ';
            if (c.text) {
                c.text.split('\n').forEach((line) => {
                    lines.push(c.level === 0 ? line : indent + line);
                });
            }
            c.images.forEach((src) => {
                lines.push(`${indent}![图片](${src})`);
            });
            lines.push('');
        });

        return lines.join('\n').replace(/\n{3,}/g, '\n\n');
    }

    function toCsv() {
        const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
        const head = ['楼层', '层级', '用户名', 'UP主', '时间', 'IP属地', '点赞', '正文', '图片', '主页'];
        const rows = State.list.map((c) => [
            c.floor || '',
            c.level === 0 ? '主楼' : '回复',
            c.name,
            c.isUp ? '是' : '',
            c.time,
            c.ip,
            c.like,
            c.text.replace(/\r?\n/g, ' '),
            c.images.join(' '),
            c.userLink
        ].map(esc).join(','));
        return '\uFEFF' + [head.map(esc).join(','), ...rows].join('\r\n');
    }

    function toJson() {
        const meta = pageMeta();
        return JSON.stringify({
            meta: { ...meta, exportedAt: stamp(), tool: `bilibili-comment-exporter v${VERSION}` },
            count: State.list.length,
            comments: State.list
        }, null, 2);
    }

    /* ============================================================
     * 4. 结构快照（诊断用：把 shadow DOM 一并序列化，供开发者读结构）
     * ============================================================ */
    function serializeWithShadow(node, budget) {
        if (!node || budget.left <= 0) return '';
        if (node.nodeType === 3) {
            const v = node.nodeValue;
            budget.left -= v.length;
            return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        if (node.nodeType === 8) return '';
        if (node.nodeType !== 1) return '';
        const tag = node.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') return '';
        budget.left -= tag.length + 20;
        let attrs = '';
        for (const a of Array.from(node.attributes || [])) {
            if (/^data-v-/.test(a.name)) continue;
            const v = a.value.length > 120 ? a.value.slice(0, 120) + '…' : a.value;
            attrs += ` ${a.name}="${v.replace(/"/g, '&quot;')}"`;
        }
        let inner = '';
        if (node.shadowRoot) {
            inner += '<template shadowrootmode="open">';
            for (const c of Array.from(node.shadowRoot.childNodes)) inner += serializeWithShadow(c, budget);
            inner += '</template>';
        }
        for (const c of Array.from(node.childNodes)) inner += serializeWithShadow(c, budget);
        if (!inner && /^(img|br|hr|input)$/.test(tag)) return `<${tag}${attrs}>`;
        return `<${tag}${attrs}>${inner}</${tag}>`;
    }

    function dumpStructure() {
        const host = findCommentsHost();
        if (!host) { toast('没找到 bili-comments，先打开评论区', 'warn'); return; }

        const budget = { left: 400000 };
        const threads = getThreads(host);
        const parts = [];
        parts.push(`<!-- B站评论区结构快照 ${stamp()} -->`);
        parts.push(`<!-- 采集环境: ${navigator.userAgent} -->`);
        parts.push(`<!-- 页面: ${location.href} -->`);
        parts.push(`<!-- 找到 bili-comments: 是 | thread 数: ${threads.length} -->`);
        parts.push('');
        parts.push('<!-- ===== 1. bili-comments 的 shadowRoot（含前 2 楼的完整嵌套） ===== -->');
        const root = sh(host);
        const head = Array.from(root.children || []).slice(0, 2);
        head.forEach((el) => { parts.push(serializeWithShadow(el, budget)); });
        parts.push('');
        parts.push('<!-- ===== 2. 单楼内部结构（第一个 thread 的完整 shadow 树） ===== -->');
        if (threads[0]) parts.push(serializeWithShadow(threads[0], budget));
        parts.push('');
        parts.push('<!-- ===== 3. 解析结果自检（脚本实际取到的值） ===== -->');
        const probe = threads.slice(0, 3).map((t, i) => {
            const one = parseComment(t.shadowRoot && t.shadowRoot.querySelector('bili-comment-renderer'), 0);
            return `第${i + 1}楼: name=${one && one.name} time=${one && one.time} ip=${one && one.ip} `
                + `like=${one && one.like} textLen=${one ? one.text.length : 0} imgs=${one ? one.images.length : 0}`;
        });
        parts.push(probe.join('\n'));

        download(`bili-comment-dom-${fileStamp()}.txt`, parts.join('\n'));
        toast('结构快照已下载，把文件路径发我', 'ok', 3200);
    }

    /* ============================================================
     * 5. Toast
     * ============================================================ */
    let toastHost = null;
    function toast(msg, type = 'ok', ms = 2000) {
        if (!toastHost) {
            toastHost = document.createElement('div');
            toastHost.id = 'xxs-bili-toast-host';
            toastHost.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;pointer-events:none;';
            document.body.appendChild(toastHost);
        }
        const el = document.createElement('div');
        const color = type === 'warn' ? '#e6a23c' : type === 'err' ? '#f56c6c' : '#4caf50';
        el.style.cssText = [
            'max-width:300px', 'margin-top:8px', 'padding:10px 14px', 'border-radius:8px',
            'background:rgba(28,28,30,.94)', 'color:#fff', 'font-size:13px', 'line-height:1.5',
            'box-shadow:0 4px 16px rgba(0,0,0,.3)', 'border-left:3px solid ' + color,
            'font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif',
            'transition:opacity .2s', 'opacity:0'
        ].join(';');
        el.textContent = msg;
        toastHost.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; });
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 250);
        }, ms);
    }

    /* ============================================================
     * 6. 面板 UI（Shadow DOM，样式隔离）
     * ============================================================ */
    const PANEL_ID = 'xxs-bili-panel-host';
    let panel = null;   // { host, shadow, root, dot, capsule, panelEl, ... }
    let collapsed = true;   // 页一打开就收起，只留圆点（不读存储，否则刷新后又弹出来）

    const CSS = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
        [hidden] { display: none !important; }

        #dot {
            position: fixed; right: 20px; bottom: 96px; width: 40px; height: 40px;
            border-radius: 50%; background: rgba(0, 174, 236, .82); color: #fff;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,.3); font-size: 18px; user-select: none;
            transition: transform .15s, background .15s, width .15s;
            z-index: 2147483646;
        }
        #dot:hover { transform: scale(1.08); background: rgb(0,174,236); }
        #dot.running { width: 92px; border-radius: 20px; font-size: 12px; gap: 4px; padding: 0 8px; }

        #panel {
            position: fixed; right: 20px; bottom: 96px; width: 292px;
            background: #1c1c1e; color: #e8e8ea; border-radius: 10px;
            box-shadow: 0 8px 28px rgba(0,0,0,.45); font-size: 13px; overflow: hidden;
            z-index: 2147483646; border: 1px solid rgba(255,255,255,.08);
        }
        #panel.hidden { display: none !important; }
        .head {
            display: flex; align-items: center; gap: 6px; padding: 9px 10px;
            background: rgba(255,255,255,.05); cursor: move; user-select: none;
        }
        .head .title { flex: 1; font-weight: 600; font-size: 13px; }
        .head .ver { font-size: 11px; opacity: .5; }
        .head button { background: none; border: 0; color: #b9b9bd; cursor: pointer; font-size: 14px; padding: 2px 5px; border-radius: 4px; }
        .head button:hover { background: rgba(255,255,255,.1); color: #fff; }
        .body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .row { display: flex; gap: 6px; }
        .row > button { flex: 1; }
        button.act {
            padding: 7px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,.12);
            background: rgba(255,255,255,.07); color: #e8e8ea; cursor: pointer; font-size: 12px;
        }
        button.act:hover { background: rgba(255,255,255,.14); }
        button.primary { background: #00aeec; border-color: #00aeec; color: #fff; font-weight: 600; }
        button.primary:hover { background: #1cb9ee; }
        button.danger { color: #ff9c9c; }
        .stat { display: flex; gap: 10px; font-size: 12px; opacity: .85; padding: 0 2px; }
        .stat b { color: #00aeec; font-weight: 600; }
        .check { display: flex; align-items: center; gap: 6px; font-size: 12px; opacity: .85; cursor: pointer; user-select: none; }
        .check input { accent-color: #00aeec; cursor: pointer; }
        .hint { font-size: 11px; opacity: .45; line-height: 1.5; }
    `;

    function buildPanel() {
        const host = document.createElement('div');
        host.id = PANEL_ID;
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = CSS;
        shadow.appendChild(style);

        const dot = document.createElement('div');
        dot.id = 'dot';
        dot.innerHTML = '💬';
        dot.title = 'B站评论导出（Alt+X 唤出）';

        const panelEl = document.createElement('div');
        panelEl.id = 'panel';
        panelEl.innerHTML = `
            <div class="head">
                <span class="title">B站评论导出</span>
                <span class="ver">v${VERSION}</span>
                <button data-act="collapse" title="收起">—</button>
            </div>
            <div class="body">
                <div class="stat">
                    <span>主楼 <b data-stat="main">0</b></span>
                    <span>回复 <b data-stat="sub">0</b></span>
                    <span>页面 <b data-stat="threads">0</b> 楼</span>
                </div>
                <div class="row">
                    <button class="act primary" data-act="auto">开始抓取</button>
                </div>
                <label class="check"><input type="checkbox" data-act="autoScroll" checked>自动滚动（关掉=你手动翻页，脚本持续收集）</label>
                <div class="row">
                    <button class="act" data-act="md">导出 MD</button>
                    <button class="act" data-act="copy">复制</button>
                </div>
                <div class="row">
                    <button class="act" data-act="json">JSON</button>
                    <button class="act" data-act="csv">CSV</button>
                </div>
                <div class="row">
                    <button class="act" data-act="dump">结构快照</button>
                    <button class="act danger" data-act="clear">清空</button>
                </div>
                <div class="hint">点一次「开始抓取」就会一直跑到底，再点一次是暂停，不用反复点。翻页/滚动都会自动去重累积。Esc 暂停 / Alt+X 唤出。</div>
            </div>
        `;

        shadow.appendChild(dot);
        shadow.appendChild(panelEl);
        document.body.appendChild(host);

        panel = { host, shadow, dot, panelEl };
        applyCollapsed();

        dot.addEventListener('click', () => {
            if (State.running) { toggleRun(); return; }
            collapsed = !collapsed;
            applyCollapsed();
        });

        shadow.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            handleAction(btn.dataset.act, btn);
        });

        shadow.querySelector('[data-act="autoScroll"]').addEventListener('change', (e) => {
            State.autoScroll = e.target.checked;
            toast(State.autoScroll ? '已切换为自动滚动' : '已切换为手动模式');
        });

        makeDraggable(panelEl, shadow.querySelector('.head'));
    }

    /** 主按钮文案跟随运行状态：开始抓取 ↔ 暂停抓取 */
    function syncRunButton() {
        if (!panel) return;
        const btn = panel.shadow.querySelector('[data-act="auto"]');
        if (!btn) return;
        btn.textContent = State.running ? '暂停抓取' : '开始抓取';
        btn.classList.toggle('danger', State.running);
    }

    function applyCollapsed() {
        if (!panel) return;
        syncRunButton();
        const { dot, panelEl } = panel;
        if (State.running) {
            dot.hidden = false;
            dot.classList.add('running');
            dot.innerHTML = `● 抓取中 ${State.list.length}`;
            panelEl.classList.add('hidden');
            return;
        }
        if (collapsed) {
            dot.classList.remove('running');
            dot.innerHTML = State.list.length ? `● ${State.list.length}` : '💬';
            dot.hidden = false;
            panelEl.classList.add('hidden');
        } else {
            dot.hidden = true;
            panelEl.classList.remove('hidden');
            dot.classList.remove('running');
        }
        updateStats();
    }

    function updateStats() {
        if (!panel) return;
        const s = panel.shadow;
        const main = State.list.filter((c) => c.level === 0).length;
        const sub = State.list.length - main;
        let threads = 0;
        try { threads = getThreads(findCommentsHost()).length; } catch (e) { }
        s.querySelector('[data-stat="main"]').textContent = main;
        s.querySelector('[data-stat="sub"]').textContent = sub;
        s.querySelector('[data-stat="threads"]').textContent = threads;
    }

    function expandPanel() {
        collapsed = false;
        applyCollapsed();
    }

    function makeDraggable(el, handle) {
        let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
        handle.addEventListener('mousedown', (e) => {
            dragging = true;
            sx = e.clientX; sy = e.clientY;
            const r = el.getBoundingClientRect();
            ox = r.left; oy = r.top;
            el.style.left = ox + 'px';
            el.style.top = oy + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            el.style.left = Math.max(4, ox + e.clientX - sx) + 'px';
            el.style.top = Math.max(4, oy + e.clientY - sy) + 'px';
        });
        window.addEventListener('mouseup', () => { dragging = false; });
    }

    /* ============================================================
     * 7. 动作
     * ============================================================ */
    async function doScan(showToast = true) {
        State.scanning = true;
        await expandReplies();      // 楼中楼默认只渲染 2 条，先点「点击查看」
        const r = collectOnce();
        State.scanning = false;
        updateStats();
        applyCollapsed();
        if (showToast) {
            if (r.threads === 0) {
                toast('没找到评论，先展开评论区（滚动到评论区让它加载）', 'warn', 3000);
            } else if (r.added === 0) {
                toast(`没有新增（已抓 ${r.total} 条），翻页后再点一次`, 'warn', 2600);
            } else {
                toast(`+${r.added} 条，共 ${r.total} 条`, 'ok');
            }
        }
        return r;
    }

    async function toggleRun() {
        if (State.running) {
            State.running = false;
            State.paused = true;
            toast(`已暂停，共 ${State.list.length} 条`);
            expandPanel();          // 暂停后自动展开，方便立刻导出
            return;
        }
        if (!findCommentsHost()) {
            toast('还没找到评论区，先往下滚到评论区', 'warn', 2800);
            return;
        }
        State.running = true;
        State.paused = false;
        collapsed = true;
        applyCollapsed();
        toast('开始采集');

        let idle = 0;
        let lastCount = State.list.length;

        while (State.running) {
            const r = await doScan(false);
            updateStats();
            applyCollapsed();

            if (r.added > 0) { idle = 0; lastCount = r.total; } else { idle++; }

            // 自动滚动：连续 5 轮无新增才认为到底
            // 手动模式（关掉自动滚动）：永不自动停，只由用户点暂停 / Esc 结束
            if (State.autoScroll && idle >= 5) {
                State.running = false;
                toast(`到底了，共 ${State.list.length} 条`);
                expandPanel();
                break;
            }

            if (State.autoScroll) {
                const threads = getThreads(findCommentsHost());
                const last = threads[threads.length - 1];
                if (last) last.scrollIntoView({ block: 'center', behavior: 'smooth' });
                else window.scrollBy(0, 600);
                // ±25% 随机抖动，避免固定节奏
                await sleep(Math.round(1100 * (0.75 + Math.random() * 0.5)));
            } else {
                // 手动模式：不滚动，持续轮询收集
                await sleep(700);
            }
        }
    }

    async function handleAction(act, btn) {
        switch (act) {
            case 'collapse':
                collapsed = true;
                applyCollapsed();
                break;
            case 'auto':
                toggleRun();
                break;
            case 'md':
                if (!(await ensureData())) return;
                download(`B站评论-${pageMeta().type}-${fileStamp()}.md`, toMarkdown(), 'text/markdown;charset=utf-8');
                toast(`已导出 MD，${State.list.length} 条`);
                break;
            case 'copy':
                if (!(await ensureData())) return;
                copyText(toMarkdown());
                break;
            case 'json':
                if (!(await ensureData())) return;
                download(`B站评论-${fileStamp()}.json`, toJson(), 'application/json;charset=utf-8');
                toast(`已导出 JSON，${State.list.length} 条`);
                break;
            case 'csv':
                if (!(await ensureData())) return;
                download(`B站评论-${fileStamp()}.csv`, toCsv(), 'text/csv;charset=utf-8');
                toast(`已导出 CSV，${State.list.length} 条`);
                break;
            case 'dump':
                dumpStructure();
                break;
            case 'clear':
                if (!State.list.length) { toast('本来就没有数据', 'warn'); return; }
                State.list = [];
                State.seen.clear();
                updateStats();
                applyCollapsed();
                toast('已清空');
                break;
        }
    }

    async function ensureData() {
        if (!State.list.length) {
            const r = await doScan(false);
            if (!State.list.length) {
                toast('还没有数据，先点「抓取当前评论」', 'warn', 2600);
                return false;
            }
            toast(`已自动抓取 ${r.total} 条`);
        }
        return true;
    }

    function copyText(text) {
        const done = () => toast(`已复制 ${text.length} 字符`);
        try {
            if (typeof GM_setClipboard === 'function') { GM_setClipboard(text, 'text'); done(); return; }
        } catch (e) { }
        navigator.clipboard.writeText(text).then(done).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            done();
        });
    }

    function clearAll(reason) {
        State.list = [];
        State.seen.clear();
        State.running = false;
        if (panel) updateStats();
        applyCollapsed();
        if (reason) toast(reason, 'warn');
    }

    /* ============================================================
     * 8. 生命周期
     * ============================================================ */
    function ensurePanel() {
        if (!document.body) return;
        if (!document.getElementById(PANEL_ID)) {
            buildPanel();
        }
    }

    ensurePanel();

    // SPA 路由变化：换页面必须清空，避免上一稿数据串到下一稿
    setInterval(() => {
        ensurePanel();
        if (location.href !== State.lastUrl) {
            State.lastUrl = location.href;
            if (State.list.length) clearAll('页面已切换，数据已清空');
            else applyCollapsed();
        }
    }, 1200);

    // 快捷键
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && State.running) {
            e.stopPropagation();
            State.running = false;
            State.paused = true;
            toast(`已暂停，共 ${State.list.length} 条`);
            expandPanel();
        }
        if (e.altKey && (e.key === 'x' || e.key === 'X')) {
            e.preventDefault();
            collapsed = !collapsed;
            applyCollapsed();
        }
    }, true);

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('抓取评论', () => doScan(true));
        GM_registerMenuCommand('导出 Markdown', () => handleAction('md'));
        GM_registerMenuCommand('下载结构快照（排查用）', () => dumpStructure());
        GM_registerMenuCommand('显示面板', () => expandPanel());
    }

    console.log(`${TAG} v${VERSION} 已加载`);
})();
