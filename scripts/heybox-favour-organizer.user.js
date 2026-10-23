// ==UserScript==
// @name         小黑盒收藏夹整理器
// @name:en      HeyBox Favorites Organizer
// @namespace    https://xiaoheihe.cn/
// @version      1.0.0
// @description  小黑盒收藏夹批量整理：逐条进入详情抓取正文与评论（含楼中楼，默认每篇最多 50 条主楼），每条存成一个 MD 文件、最后一键下载 ZIP，也可导出 MD / JSON / CSV，并可自动取消收藏后继续下一条。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:zh-CN 小黑盒收藏夹批量整理：逐条进入详情抓取正文与评论（含楼中楼，默认每篇最多 50 条主楼），每条存成一个 MD 文件、最后一键下载 ZIP，也可导出 MD / JSON / CSV，并可自动取消收藏后继续下一条。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:en Batch-organize HeyBox favorites: open each item and capture the post body plus comments (nested replies included, 50 top-level comments per post by default). Each item is saved as its own Markdown file and everything is packed into one ZIP; MD / JSON / CSV export is also available, and un-favoriting before moving on is optional. Feedback via Telegram: https://t.me/zzyyffxx
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/heybox-favour-organizer.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/heybox-favour-organizer.user.js
// @match        https://*.xiaoheihe.cn/app/user/favour/*
// @match        https://xiaoheihe.cn/app/user/favour/*
// @match        https://*.xiaoheihe.cn/app/bbs/link/*
// @match        https://xiaoheihe.cn/app/bbs/link/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @license      MIT
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 0. 常量
    // ==========================================
    const KEY = 'hb_favour_organizer_v1';
    const LIST_PATH = /^\/app\/user\/favour\//;
    const DETAIL_PATH = /^\/app\/bbs\/link\/(\d+)/;
    const FAVOUR_URL = 'https://xiaoheihe.cn/app/user/favour/content';

    const DEFAULT_OPTS = {
        removeFav: true,   // 整理完自动取消收藏
        copyEach: false,   // 每整理一条自动复制该条 Markdown
        autoZip: false,    // 全部跑完后自动打包下载 zip
        maxComments: 50,   // 每篇最多采集多少条主楼评论（0 = 不限）
        maxReplies: 10,    // 每条主楼最多保留多少条楼中楼回复（0 = 不限）
        minDelay: 700,
        maxDelay: 1500
    };

    const state = {
        running: false,
        current: null,
        lastTick: 0,
        records: [],
        failed: [],
        opts: { ...DEFAULT_OPTS },
        collapsed: false,
        startedAt: 0
    };

    // ==========================================
    // 1. 存储
    // ==========================================
    function loadState() {
        try {
            const raw = GM_getValue(KEY, '');
            if (!raw) return;
            const s = JSON.parse(raw);
            if (!s || typeof s !== 'object') return;
            state.running = !!s.running;
            state.current = s.current || null;
            state.lastTick = Number(s.lastTick) || 0;
            state.records = Array.isArray(s.records) ? s.records : [];
            state.failed = Array.isArray(s.failed) ? s.failed : [];
            state.opts = { ...DEFAULT_OPTS, ...(s.opts || {}) };
            state.collapsed = !!s.collapsed;
            state.startedAt = Number(s.startedAt) || 0;
        } catch (e) {
            console.warn('[HB收藏整理] 读取状态失败', e);
        }
    }

    function saveState() {
        try {
            GM_setValue(KEY, JSON.stringify({
                running: state.running,
                current: state.current,
                lastTick: state.lastTick,
                records: state.records,
                failed: state.failed,
                opts: state.opts,
                collapsed: state.collapsed,
                startedAt: state.startedAt
            }));
        } catch (e) {
            console.warn('[HB收藏整理] 保存状态失败', e);
        }
    }

    // ==========================================
    // 2. 工具
    // ==========================================
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const rand = (a, b) => Math.floor(a + Math.random() * (b - a));
    const delay = () => sleep(rand(state.opts.minDelay || 700, state.opts.maxDelay || 1500));

    function txt(el) {
        return el ? (el.innerText || el.textContent || '').trim() : '';
    }

    /** 递归取文本：emoji 转 [cube_xx]、br 转换行、img 跳过 */
    function nodeText(el) {
        if (!el) return '';
        let out = '';
        const walk = (n) => {
            if (n.nodeType === 3) { out += n.nodeValue; return; }
            if (n.nodeType !== 1) return;
            const cls = typeof n.className === 'string' ? n.className : '';
            if (cls.split(/\s+/).indexOf('hb-emoji') >= 0) {
                const e = n.getAttribute('data-emoji');
                if (e) out += '[' + e + ']';
                return;
            }
            if (n.tagName === 'BR') { out += '\n'; return; }
            if (n.tagName === 'IMG') return;
            if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
            for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
        };
        walk(el);
        return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function waitFor(fn, timeout, interval) {
        timeout = timeout || 15000;
        interval = interval || 220;
        return new Promise((resolve) => {
            const t0 = Date.now();
            const tick = () => {
                let ok = false;
                try { ok = !!fn(); } catch (e) { ok = false; }
                if (ok) return resolve(true);
                if (Date.now() - t0 > timeout) return resolve(false);
                setTimeout(tick, interval);
            };
            tick();
        });
    }

    const onListPage = () => LIST_PATH.test(location.pathname);
    const onDetailPage = () => DETAIL_PATH.test(location.pathname);
    const currentDetailId = () => {
        const m = location.pathname.match(DETAIL_PATH);
        return m ? m[1] : null;
    };

    function fmtTime(ts) {
        const d = new Date(ts || Date.now());
        const p = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    }

    function stamp() {
        const d = new Date();
        const p = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
    }

    function download(name, text, mime) {
        try {
            const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                a.remove();
            }, 8000);
            return true;
        } catch (e) {
            console.warn('[HB收藏整理] 下载失败', e);
            return false;
        }
    }

    function copyText(text) {
        try {
            GM_setClipboard(text, 'text');
            return true;
        } catch (e) {
            try {
                navigator.clipboard.writeText(text);
                return true;
            } catch (e2) {
                return false;
            }
        }
    }

    // ==========================================
    // 3. 采集：详情页解析
    // ==========================================
    /** 取图片真实地址：懒加载未触发时 img.src 会等于当前页地址，必须过滤掉 */
    function imgSrcOf(img) {
        if (!img) return '';
        const cands = [
            img.getAttribute('data-src'),
            img.getAttribute('data-original'),
            img.getAttribute('data-lazy-src'),
            img.currentSrc,
            img.getAttribute('src')
        ];
        for (let i = 0; i < cands.length; i++) {
            const v = (cands[i] || '').trim();
            if (!v) continue;
            if (!/^https?:\/\//i.test(v)) continue;
            // 懒加载占位：src 被写成当前页面地址
            if (v === location.href) continue;
            if (v.indexOf('xiaoheihe.cn/app/bbs/link/') >= 0) continue;
            return v;
        }
        return '';
    }

    /** 正文图片是懒加载的：没滚进视口前 src 是空串或当前页地址。
     *  采集前先把它们逐个滚进视口，等 src 变成真实图床地址。 */
    async function warmupImages(log) {
        const sel = '.post__content img, .hb-article img, .image-text__header-image img, .image-text__content img';
        const imgs = [].slice.call(document.querySelectorAll(sel));
        let loaded = 0;
        for (let i = 0; i < imgs.length; i++) {
            const im = imgs[i];
            if (imgSrcOf(im)) continue;
            try { im.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
            for (let w = 0; w < 6; w++) {
                await sleep(180);
                if (imgSrcOf(im)) { loaded++; break; }
            }
        }
        window.scrollTo(0, 0);
        if (log && loaded) log('已加载 ' + loaded + ' 张懒加载图片');
        return { total: imgs.length, loaded: loaded };
    }

    /** 把正文按块结构取出，保留段落 / 标题 / 图片 / 代码 */
    function extractBlocks() {
        const blocks = [];
        const push = (type, value) => {
            if (!value) return;
            const last = blocks[blocks.length - 1];
            if (last && last.type === type && last.value === value) return;
            blocks.push({ type, value });
        };

        // ---- 形态 B：图文帖 ----
        // 正文是 .image-text__content 里的一坨纯文本（换行即分段），
        // 配图在兄弟节点 .image-text__header-image 的轮播里。
        const imageText = document.querySelector('.image-text__content');
        if (imageText) {
            const header = document.querySelector('.image-text__header-image');
            if (header) {
                const imgs = header.querySelectorAll('img');
                for (let i = 0; i < imgs.length; i++) {
                    const s = imgSrcOf(imgs[i]);
                    if (s) push('img', s);
                }
            }
            const raw = imageText.innerText || imageText.textContent || '';
            const paras = raw.split(/\n+/);
            for (let i = 0; i < paras.length; i++) {
                const line = paras[i].trim();
                if (!line) continue;
                if (line.charAt(0) === '>' && line.length < 12) continue;
                push('p', line);
            }
            return blocks;
        }

        // ---- 形态 A：文章帖 ----
        const root = document.querySelector('.post__content');
        if (!root) return blocks;
        const walk = (node) => {
            for (let i = 0; i < node.children.length; i++) {
                const el = node.children[i];
                const tag = el.tagName.toLowerCase();
                const cls = typeof el.className === 'string' ? el.className : '';
                const parts = cls.split(/\s+/);

                if (parts.indexOf('hb-emoji') >= 0) continue;

                if (tag === 'p' || parts.indexOf('text') >= 0) {
                    push('p', nodeText(el));
                } else if (/^h[1-6]$/.test(tag) || parts.indexOf('main-title') >= 0) {
                    push('h', nodeText(el));
                } else if (parts.indexOf('img') >= 0) {
                    const s = imgSrcOf(el.querySelector('img'));
                    if (s) push('img', s);
                } else if (tag === 'pre') {
                    push('code', (el.innerText || '').replace(/\s+$/, ''));
                } else if (tag === 'blockquote') {
                    push('quote', nodeText(el));
                } else if (tag === 'ul' || tag === 'ol') {
                    const items = [];
                    for (let j = 0; j < el.children.length; j++) {
                        const t = nodeText(el.children[j]);
                        if (t) items.push(t);
                    }
                    if (items.length) push('list', items.join('\n'));
                } else if (tag === 'a') {
                    const t = nodeText(el);
                    if (t) push('p', t);
                } else if (el.children.length) {
                    walk(el);
                } else {
                    push('p', nodeText(el));
                }
            }
        };
        walk(root);
        return blocks;
    }

    function extractComments() {
        const items = document.querySelectorAll('.link-comment__comment-item');
        const maxComments = Number(state.opts.maxComments) || 0;
        const maxReplies = Number(state.opts.maxReplies) || 0;
        const out = [];
        const limit = (maxComments > 0 && items.length > maxComments) ? maxComments : items.length;
        for (let i = 0; i < limit; i++) {
            const item = items[i];
            const q = (s) => item.querySelector(s);
            const replies = [];
            const kids = item.querySelectorAll('.comment-children-item');
            const kidLimit = (maxReplies > 0 && kids.length > maxReplies) ? maxReplies : kids.length;
            for (let j = 0; j < kidLimit; j++) {
                const c = kids[j];
                replies.push({
                    id: c.dataset.commentId || '',
                    user: txt(c.querySelector('.children-item__comment-creator')).replace(/回复\s*$/, ''),
                    content: nodeText(c.querySelector('.children-item__comment-content')),
                    time: txt(c.querySelector('.children-item__create-time')),
                    ip: txt(c.querySelector('.children-item__ip')).replace(/^·/, '')
                });
            }
            out.push({
                id: item.dataset.commentId || '',
                user: txt(q('.info-box__username')),
                level: txt(q('.info-box__level')).replace(/^Lv\.?\s*/, ''),
                likes: txt(q('.like-box__cnt')),
                time: txt(q('.info-box__create-time')),
                ip: txt(q('.info-box__ip')).replace(/^·/, ''),
                content: nodeText(q('.comment-item__content')),
                replies: replies,
                repliesTotal: kids.length
            });
        }
        return out;
    }

    function extractDetail() {
        const linkId = currentDetailId() || '';
        const tags = [];
        const tagNodes = document.querySelectorAll('.link-section-tags .content-tag-text, .link-section-tags a, .link-section-tags span');
        for (let i = 0; i < tagNodes.length; i++) {
            const t = txt(tagNodes[i]);
            if (t && tags.indexOf(t) < 0) tags.push(t);
        }
        const title = txt(document.querySelector('.link-section-title')) || document.title;
        const blocks = extractBlocks();
        const comments = extractComments();
        const favourBtn = document.querySelector('.hb-cpt__favour-btn');
        // 页面上实际渲染了多少条（用于标记「已截断」）
        const onPageComments = document.querySelectorAll('.link-comment__comment-item').length;
        const onPageReplies = document.querySelectorAll('.comment-children-item').length;
        const maxComments = Number(state.opts.maxComments) || 0;
        const maxReplies = Number(state.opts.maxReplies) || 0;
        return {
            linkId: linkId,
            url: 'https://xiaoheihe.cn/app/bbs/link/' + linkId,
            title: title,
            author: txt(document.querySelector('.link-user__username')),
            time: txt(document.querySelector('.link-data__time')),
            ip: txt(document.querySelector('.link-data__ip')).replace(/^·/, ''),
            tags: tags,
            blocks: blocks,
            bodyText: blocks.filter((b) => b.type === 'p' || b.type === 'h' || b.type === 'code' || b.type === 'quote' || b.type === 'list').map((b) => b.value).join('\n\n'),
            comments: comments,
            commentCount: comments.length,
            replyCount: comments.reduce((s, c) => s + c.replies.length, 0),
            commentTotalOnPage: onPageComments,
            replyTotalOnPage: onPageReplies,
            truncated: (maxComments > 0 && onPageComments > maxComments) ||
                (maxReplies > 0 && comments.some((c) => (c.repliesTotal || 0) > maxReplies)),
            wasFavourited: !!(favourBtn && favourBtn.classList.contains('active')),
            collectedAt: Date.now()
        };
    }

    /** 反复点开「全部 N 条回复」/ 加载更多，直到不再出现新内容
     *  按 state.opts.maxComments / maxReplies 上限截断，避免超大热帖撑爆内存 */
    async function expandEverything(log) {
        const maxComments = Number(state.opts.maxComments) || 0;
        const maxReplies = Number(state.opts.maxReplies) || 0;
        let stable = 0;
        let lastComments = -1;
        let lastReplies = -1;

        const reachedLimit = () => {
            const c = document.querySelectorAll('.link-comment__comment-item').length;
            const r = document.querySelectorAll('.comment-children-item').length;
            const cHit = maxComments > 0 && c >= maxComments;
            // 按「实际主楼数 × 每条上限」算总预算，而不是「上限主楼数 × 每条上限」
            const rHit = maxReplies > 0 && c > 0 && r >= c * maxReplies;
            return cHit || rHit;
        };

        for (let round = 0; round < 40; round++) {
            // 暂停 / 收到停止信号时立刻退出，别继续点「加载更多」
            if (!state.running) {
                if (log) log('已暂停，停止展开');
                break;
            }
            if (reachedLimit()) {
                if (log) log('已达采集上限，停止展开');
                break;
            }
            let clicked = 0;

            const loadAll = document.querySelectorAll('.comment-children__load-all');
            for (let i = 0; i < loadAll.length; i++) {
                try { loadAll[i].click(); clicked++; } catch (e) { /* ignore */ }
            }

            const candidates = document.querySelectorAll('button, div, span, a');
            for (let i = 0; i < candidates.length; i++) {
                const el = candidates[i];
                if (el.children.length > 2) continue;
                const t = (el.textContent || '').trim();
                if (!t || t.length > 16) continue;
                if (/^(展开全文|展开更多|查看更多|加载更多|更多评论|查看全部|点击展开)/.test(t)) {
                    try { el.click(); clicked++; } catch (e) { /* ignore */ }
                }
            }

            if (clicked) {
                await sleep(1000);
            } else {
                window.scrollBy(0, 1200);
                await sleep(700);
            }

            const c = document.querySelectorAll('.link-comment__comment-item').length;
            const r = document.querySelectorAll('.comment-children-item').length;
            if (c === lastComments && r === lastReplies) {
                stable++;
                if (stable >= 2) break;
            } else {
                stable = 0;
                lastComments = c;
                lastReplies = r;
                if (log) log('展开中：主楼 ' + c + ' / 回复 ' + r);
            }

            if (round === 39) break;
        }
        window.scrollTo(0, 0);
        return {
            comments: document.querySelectorAll('.link-comment__comment-item').length,
            replies: document.querySelectorAll('.comment-children-item').length,
            limited: reachedLimit()
        };
    }

    // ==========================================
    // 4. 取消收藏
    // ==========================================
    async function cancelFavour(log) {
        const btn = document.querySelector('.hb-cpt__favour-btn');
        if (!btn) return { ok: false, reason: '页面上没有收藏按钮' };
        if (!btn.classList.contains('active')) return { ok: true, reason: '本来就没收藏' };

        for (let attempt = 0; attempt < 2; attempt++) {
            try { btn.click(); } catch (e) { /* ignore */ }
            const cleared = await waitFor(() => {
                const b = document.querySelector('.hb-cpt__favour-btn');
                return b && !b.classList.contains('active');
            }, 5000, 200);
            if (cleared) return { ok: true, reason: '已取消收藏' };
            if (log) log('取消收藏未生效，重试 ' + (attempt + 1));
            await sleep(600);
        }
        return { ok: false, reason: '点了两次仍未取消' };
    }

    // ==========================================
    // 5. 渲染
    // ==========================================
    function renderMarkdown(r) {
        const lines = [];
        lines.push('## ' + (r.title || '(无标题)'));
        lines.push('');
        const meta = [];
        if (r.author) meta.push('作者：' + r.author);
        if (r.time) meta.push('时间：' + r.time + (r.ip ? ' · ' + r.ip : ''));
        if (r.tags && r.tags.length) meta.push('标签：' + r.tags.join(' / '));
        meta.push('链接：' + r.url);
        const cmtLine = '评论：' + r.commentCount + ' 条主楼 / ' + r.replyCount + ' 条回复';
        meta.push(r.truncated ? cmtLine + '（已截断' + (r.commentTotalOnPage ? '，页面共 ' + r.commentTotalOnPage + ' 主楼' : '') + '）' : cmtLine);
        meta.forEach((m) => lines.push('- ' + m));
        lines.push('');

        if (r.blocks && r.blocks.length) {
            for (let i = 0; i < r.blocks.length; i++) {
                const b = r.blocks[i];
                if (b.type === 'h') { lines.push('### ' + b.value); lines.push(''); }
                else if (b.type === 'img') { lines.push('![](' + b.value + ')'); lines.push(''); }
                else if (b.type === 'code') { lines.push('```'); lines.push(b.value); lines.push('```'); lines.push(''); }
                else if (b.type === 'quote') { lines.push('> ' + b.value.split('\n').join('\n> ')); lines.push(''); }
                else { lines.push(b.value); lines.push(''); }
            }
        } else if (r.bodyText) {
            lines.push(r.bodyText);
            lines.push('');
        }

        if (r.comments && r.comments.length) {
            lines.push('### 评论');
            lines.push('');
            r.comments.forEach((c, i) => {
                const head = (i + 1) + '. **' + (c.user || '匿名') + '**' +
                    (c.level ? '（Lv.' + c.level + '）' : '') +
                    (c.likes ? ' · ' + c.likes + ' 赞' : '') +
                    (c.time ? ' · ' + c.time : '') +
                    (c.ip ? ' · ' + c.ip : '');
                lines.push(head);
                lines.push('   > ' + (c.content || '').split('\n').join('\n   > '));
                if (c.replies && c.replies.length) {
                    c.replies.forEach((s) => {
                        lines.push('   - **' + (s.user || '匿名') + '**' + (s.time ? '（' + s.time + (s.ip ? ' · ' + s.ip : '') + '）' : '') + '：' + (s.content || ''));
                    });
                }
                lines.push('');
            });
        }
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    }

    function renderFullMarkdown(records) {
        const head = ['# 小黑盒收藏夹整理', '', '> 导出时间：' + new Date().toLocaleString('zh-CN') + ' · 共 ' + records.length + ' 条', ''];
        return head.join('\n') + '\n---\n\n' + records.map(renderMarkdown).join('\n---\n\n');
    }

    function renderCSV(records) {
        const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const rows = [['linkId', '标题', '作者', '时间', 'IP', '标签', '主楼评论数', '回复数', '正文', '评论全文', '链接'].map(esc).join(',')];
        records.forEach((r) => {
            const commentText = (r.comments || []).map((c) => {
                const kids = (c.replies || []).map((s) => '  - ' + s.user + '：' + s.content).join('\n');
                return c.user + (c.likes ? '(' + c.likes + '赞)' : '') + '：' + c.content + (kids ? '\n' + kids : '');
            }).join('\n');
            rows.push([r.linkId, r.title, r.author, r.time, r.ip, (r.tags || []).join(' / '), r.commentCount, r.replyCount, r.bodyText, commentText, r.url].map(esc).join(','));
        });
        return '\uFEFF' + rows.join('\r\n');
    }

    // ==========================================
    // 5.5 ZIP 打包（STORE 模式，无外部依赖）
    // ==========================================
    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    const utf8 = (s) => new TextEncoder().encode(s);

    /** 文件名清洗：去掉 Windows / macOS / Linux 非法字符 */
    function safeName(s, maxLen) {
        let out = String(s == null ? '' : s)
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^[.\s]+|[.\s]+$/g, '')
            .trim();
        const limit = maxLen || 60;
        if (out.length > limit) out = out.slice(0, limit).trim();
        return out || '未命名';
    }

    /** 把 [{name, text}] 打成一个 zip 的 Blob（不压缩，兼容性最好） */
    function buildZip(files) {
        const now = new Date();
        const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
        const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

        const locals = [];
        const centrals = [];
        let offset = 0;

        for (let i = 0; i < files.length; i++) {
            const nameBytes = utf8(files[i].name);
            const dataBytes = utf8(files[i].text);
            const crc = crc32(dataBytes);
            const size = dataBytes.length;

            const lh = new Uint8Array(30 + nameBytes.length);
            const lv = new DataView(lh.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);            // version needed
            lv.setUint16(6, 0x0800, true);        // flag: UTF-8 文件名
            lv.setUint16(8, 0, true);             // method: store
            lv.setUint16(10, dosTime, true);
            lv.setUint16(12, dosDate, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, size, true);
            lv.setUint32(22, size, true);
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);
            lh.set(nameBytes, 30);
            locals.push(lh, dataBytes);

            const ch = new Uint8Array(46 + nameBytes.length);
            const cv = new DataView(ch.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0x0800, true);
            cv.setUint16(10, 0, true);
            cv.setUint16(12, dosTime, true);
            cv.setUint16(14, dosDate, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, size, true);
            cv.setUint32(24, size, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint16(30, 0, true);
            cv.setUint16(32, 0, true);
            cv.setUint16(34, 0, true);
            cv.setUint16(36, 0, true);
            cv.setUint32(38, 0, true);
            cv.setUint32(42, offset, true);
            ch.set(nameBytes, 46);
            centrals.push(ch);

            offset += lh.length + size;
        }

        let cdSize = 0;
        for (let i = 0; i < centrals.length; i++) cdSize += centrals[i].length;

        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, files.length, true);
        ev.setUint16(10, files.length, true);
        ev.setUint32(12, cdSize, true);
        ev.setUint32(16, offset, true);
        ev.setUint16(20, 0, true);

        const parts = locals.concat(centrals, [eocd]);
        return new Blob(parts, { type: 'application/zip' });
    }

    function downloadBlob(name, blob) {
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                a.remove();
            }, 15000);
            return true;
        } catch (e) {
            console.warn('[HB收藏整理] 打包下载失败', e);
            return false;
        }
    }

    /** 每条记录单独一个 .md，外加一份 index.md，装进 zip */
    function buildArchive(records) {
        const files = [];
        const dir = '小黑盒收藏-' + stamp();
        const index = [];
        index.push('# 小黑盒收藏夹整理');
        index.push('');
        index.push('> 导出时间：' + new Date().toLocaleString('zh-CN') + ' · 共 ' + records.length + ' 条');
        index.push('');

        records.forEach((r, i) => {
            const no = String(i + 1).padStart(3, '0');
            const base = no + '-' + safeName(r.title || r.linkId) + '.md';
            files.push({ name: dir + '/' + base, text: renderMarkdown(r) });
            // 链接文字用清洗后的名字，避免标题里的 [] 破坏 Markdown 语法
            index.push('- [' + base.replace(/\.md$/, '') + '](<' + base + '>) — ' +
                (r.author || '') + (r.time ? ' · ' + r.time : '') + ' · ' + (r.commentCount || 0) + ' 评论');
        });

        index.push('');
        index.push('原始链接：');
        index.push('');
        records.forEach((r, i) => {
            index.push((i + 1) + '. [' + safeName(r.title || r.linkId) + '](' + r.url + ')');
        });

        files.unshift({ name: dir + '/index.md', text: index.join('\n') + '\n' });
        return { dir: dir, files: files, blob: buildZip(files) };
    }

    // ==========================================
    // 6. UI（Shadow DOM）
    // ==========================================
    const UI = {
        host: null,
        root: null,
        panel: null,
        capsule: null,
        toastBox: null,
        drag: null,

        mount() {
            if (this.host) return;
            const host = document.createElement('div');
            host.id = 'hb-favour-organizer-host';
            host.style.cssText = 'all:initial;position:fixed;z-index:2147483000;top:0;left:0;';
            document.documentElement.appendChild(host);
            this.host = host;
            this.root = host.attachShadow({ mode: 'open' });
            this.root.innerHTML = this.template();
            this.panel = this.root.querySelector('.hbf-panel');
            this.capsule = this.root.querySelector('.hbf-capsule');
            this.toastBox = this.root.querySelector('.hbf-toasts');
            this.bind();
            this.applyCollapsed();
            this.refresh();
        },

        template() {
            return `
<style>
  *, *::before, *::after { box-sizing: border-box; }
  :host { all: initial; }
  [hidden] { display: none !important; }
  .hbf-panel {
    position: fixed; top: 96px; right: 24px; width: 344px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    font-size: 12px; color: #e8eaed; background: #202124;
    border: 1px solid #3c4043; border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,.45); overflow: hidden; user-select: none;
  }
  .hbf-head {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 10px; background: #2b2f33; cursor: move;
  }
  .hbf-title { flex: 1; font-size: 13px; font-weight: 600; letter-spacing: .2px; }
  .hbf-ver { font-size: 10px; color: #9aa0a6; }
  .hbf-min {
    width: 22px; height: 22px; border: 0; border-radius: 5px; cursor: pointer;
    background: #3c4043; color: #e8eaed; font-size: 13px; line-height: 1;
  }
  .hbf-min:hover { background: #4a4f54; }
  .hbf-body { padding: 10px; }
  .hbf-stat { display: flex; gap: 10px; margin-bottom: 8px; color: #bdc1c6; }
  .hbf-stat b { color: #8ab4f8; font-weight: 600; }
  .hbf-row { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
  .hbf-btn {
    flex: 1 1 0; min-width: 72px; padding: 7px 8px; border: 0; border-radius: 6px;
    background: #3c4043; color: #e8eaed; font-size: 12px; cursor: pointer;
  }
  .hbf-btn:hover { background: #4a4f54; }
  .hbf-btn.primary { background: #8ab4f8; color: #202124; font-weight: 600; }
  .hbf-btn.primary:hover { background: #aecbfa; }
  .hbf-btn.danger { background: #5c2b29; color: #f6aea9; }
  .hbf-btn.danger:hover { background: #7a3835; }
  .hbf-btn:disabled { opacity: .45; cursor: not-allowed; }
  .hbf-opts { display: flex; flex-direction: column; gap: 5px; margin: 8px 0; color: #bdc1c6; }
  .hbf-opts label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .hbf-opts input { accent-color: #8ab4f8; }
  .hbf-nums { display: flex; gap: 10px; margin: 2px 0 8px; color: #bdc1c6; }
  .hbf-nums label { display: flex; align-items: center; gap: 4px; flex: 1; }
  .hbf-nums input {
    width: 52px; padding: 3px 5px; border-radius: 5px;
    background: #202124; border: 1px solid #3c4043; color: #e8eaed;
    font-family: inherit; font-size: 12px;
  }
  .hbf-log {
    max-height: 128px; overflow: auto; background: #17181a; border-radius: 6px;
    padding: 6px 8px; font-size: 11px; line-height: 1.55; color: #9aa0a6;
    font-family: Consolas, "Cascadia Mono", monospace; white-space: pre-wrap; word-break: break-all;
  }
  .hbf-log .ok { color: #81c995; }
  .hbf-log .err { color: #f28b82; }
  .hbf-capsule {
    position: fixed; right: 18px; bottom: 82px; display: flex; align-items: center; gap: 6px;
    height: 30px; padding: 0 10px; border-radius: 15px; cursor: pointer;
    background: #202124; border: 1px solid #3c4043; box-shadow: 0 4px 14px rgba(0,0,0,.4);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    font-size: 12px; color: #e8eaed; white-space: nowrap;
  }
  .hbf-capsule:hover { background: #2b2f33; }
  .hbf-dot { width: 7px; height: 7px; border-radius: 50%; background: #8ab4f8; }
  .hbf-dot.run { background: #fdd663; animation: hbf-pulse 1.1s infinite; }
  @keyframes hbf-pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
  .hbf-toasts { position: fixed; right: 18px; bottom: 18px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
  .hbf-toast {
    max-width: 300px; padding: 8px 12px; border-radius: 8px;
    background: #2b2f33; border: 1px solid #3c4043; color: #e8eaed;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    font-size: 12px; line-height: 1.5; box-shadow: 0 6px 18px rgba(0,0,0,.4);
    animation: hbf-in .18s ease-out;
  }
  .hbf-toast.err { border-color: #7a3835; color: #f6aea9; }
  .hbf-toast.ok { border-color: #2e5c3a; color: #a8e6b8; }
  @keyframes hbf-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
</style>

<div class="hbf-panel">
  <div class="hbf-head">
    <span class="hbf-title">小黑盒收藏夹整理器</span>
    <span class="hbf-ver">v1.0.0</span>
    <button class="hbf-min" data-act="collapse" title="收起">—</button>
  </div>
  <div class="hbf-body">
    <div class="hbf-stat">
      <span>已整理 <b class="hbf-n-done">0</b></span>
      <span>失败 <b class="hbf-n-fail">0</b></span>
      <span>状态 <b class="hbf-n-state">待机</b></span>
    </div>
    <div class="hbf-row">
      <button class="hbf-btn primary" data-act="start">开始整理</button>
      <button class="hbf-btn" data-act="pause">暂停</button>
    </div>
    <div class="hbf-opts">
      <label><input type="checkbox" data-opt="removeFav"> 整理完取消收藏</label>
      <label><input type="checkbox" data-opt="copyEach"> 每条自动复制到剪贴板</label>
      <label><input type="checkbox" data-opt="autoZip"> 全部完成后自动打包 zip</label>
    </div>
    <div class="hbf-nums">
      <label>每篇最多评论 <input type="number" min="0" step="10" data-opt-num="maxComments"></label>
      <label>每条最多回复 <input type="number" min="0" step="5" data-opt-num="maxReplies"></label>
    </div>
    <div class="hbf-row">
      <button class="hbf-btn primary" data-act="export-zip">下载 ZIP（每篇一个 MD）</button>
    </div>
    <div class="hbf-row">
      <button class="hbf-btn" data-act="export-md">导出 MD</button>
      <button class="hbf-btn" data-act="export-json">JSON</button>
      <button class="hbf-btn" data-act="export-csv">CSV</button>
    </div>
    <div class="hbf-row">
      <button class="hbf-btn" data-act="copy-all">复制全部 MD</button>
      <button class="hbf-btn danger" data-act="clear">清空数据</button>
    </div>
    <div class="hbf-log">等待开始。请在收藏页点「开始整理」。</div>
  </div>
</div>

<div class="hbf-capsule" hidden>
  <span class="hbf-dot"></span>
  <span class="hbf-cap-text">待机</span>
</div>

<div class="hbf-toasts"></div>`;
        },

        bind() {
            this.root.addEventListener('click', (e) => {
                const t = e.target;
                const act = t && t.getAttribute ? t.getAttribute('data-act') : null;
                if (act) { this.onAction(act); return; }
                if (t.closest && t.closest('.hbf-capsule')) {
                    state.collapsed = false;
                    saveState();
                    this.applyCollapsed();
                }
            });

            this.root.addEventListener('change', (e) => {
                const opt = e.target && e.target.getAttribute ? e.target.getAttribute('data-opt') : null;
                const numOpt = e.target && e.target.getAttribute ? e.target.getAttribute('data-opt-num') : null;
                if (numOpt) {
                    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                    state.opts[numOpt] = v;
                    e.target.value = v;
                    saveState();
                    const label = { maxComments: '每篇最多评论', maxReplies: '每条最多回复' }[numOpt] || numOpt;
                    this.toast(label + '：' + (v === 0 ? '不限' : v + ' 条'));
                    return;
                }
                if (!opt) return;
                state.opts[opt] = !!e.target.checked;
                saveState();
                const label = { removeFav: '整理完取消收藏', copyEach: '每条自动复制', autoZip: '完成后自动打包' }[opt] || opt;
                this.toast('设置已保存：' + label + ' ' + (e.target.checked ? '开' : '关'));
            });

            // 拖动
            const head = this.root.querySelector('.hbf-head');
            let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
            head.addEventListener('mousedown', (e) => {
                if (e.target.getAttribute && e.target.getAttribute('data-act')) return;
                const r = this.panel.getBoundingClientRect();
                dragging = true;
                sx = e.clientX; sy = e.clientY;
                ox = r.left; oy = r.top;
                this.panel.style.right = 'auto';
                this.panel.style.left = r.left + 'px';
                this.panel.style.top = r.top + 'px';
                e.preventDefault();
            });
            window.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                const nx = Math.max(0, Math.min(window.innerWidth - 120, ox + e.clientX - sx));
                const ny = Math.max(0, Math.min(window.innerHeight - 40, oy + e.clientY - sy));
                this.panel.style.left = nx + 'px';
                this.panel.style.top = ny + 'px';
            });
            window.addEventListener('mouseup', () => { dragging = false; });
        },

        onAction(act) {
            if (act === 'collapse') {
                state.collapsed = true;
                saveState();
                this.applyCollapsed();
                return;
            }
            if (act === 'start') { Runner.start(); return; }
            if (act === 'pause') { Runner.pause(); return; }
            if (act === 'clear') { Runner.clear(); return; }
            if (act === 'copy-all') { Exporter.copyAll(); return; }
            if (act === 'export-zip') { Exporter.zip(); return; }
            if (act === 'export-md') { Exporter.md(); return; }
            if (act === 'export-json') { Exporter.json(); return; }
            if (act === 'export-csv') { Exporter.csv(); return; }
        },

        applyCollapsed() {
            if (!this.panel) return;
            this.panel.hidden = !!state.collapsed;
            this.capsule.hidden = !state.collapsed;
            this.refreshCapsule();
        },

        toggle() {
            state.collapsed = !state.collapsed;
            saveState();
            this.applyCollapsed();
        },

        refreshCapsule() {
            if (!this.capsule) return;
            const dot = this.capsule.querySelector('.hbf-dot');
            const t = this.capsule.querySelector('.hbf-cap-text');
            dot.classList.toggle('run', state.running);
            if (state.running) t.textContent = '整理中 ' + state.records.length;
            else if (state.records.length) t.textContent = '已整理 ' + state.records.length;
            else t.textContent = '待机';
        },

        refresh() {
            if (!this.root) return;
            const done = this.root.querySelector('.hbf-n-done');
            const fail = this.root.querySelector('.hbf-n-fail');
            const st = this.root.querySelector('.hbf-n-state');
            if (done) done.textContent = state.records.length;
            if (fail) fail.textContent = state.failed.length;
            if (st) st.textContent = state.running ? '运行中' : (state.records.length ? '已暂停' : '待机');

            const rf = this.root.querySelector('[data-opt="removeFav"]');
            const ce = this.root.querySelector('[data-opt="copyEach"]');
            const az = this.root.querySelector('[data-opt="autoZip"]');
            if (rf) rf.checked = !!state.opts.removeFav;
            if (ce) ce.checked = !!state.opts.copyEach;
            if (az) az.checked = !!state.opts.autoZip;

            const mc = this.root.querySelector('[data-opt-num="maxComments"]');
            const mr = this.root.querySelector('[data-opt-num="maxReplies"]');
            if (mc) mc.value = Number(state.opts.maxComments) || 0;
            if (mr) mr.value = Number(state.opts.maxReplies) || 0;

            const startBtn = this.root.querySelector('[data-act="start"]');
            if (startBtn) startBtn.textContent = state.running ? '运行中…' : (state.records.length ? '继续整理' : '开始整理');

            this.refreshCapsule();
        },

        log(msg, cls) {
            if (!this.root) return;
            const box = this.root.querySelector('.hbf-log');
            if (!box) return;
            if (box.dataset.fresh !== '1') { box.textContent = ''; box.dataset.fresh = '1'; }
            const line = document.createElement('div');
            if (cls) line.className = cls;
            const d = new Date();
            const p = (n) => String(n).padStart(2, '0');
            line.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '  ' + msg;
            box.appendChild(line);
            while (box.children.length > 120) box.removeChild(box.firstChild);
            box.scrollTop = box.scrollHeight;
        },

        toast(msg, cls) {
            if (!this.toastBox) return;
            const el = document.createElement('div');
            el.className = 'hbf-toast' + (cls ? ' ' + cls : '');
            el.textContent = msg;
            this.toastBox.appendChild(el);
            setTimeout(() => el.remove(), 2400);
        }
    };

    // ==========================================
    // 7. 导出
    // ==========================================
    const Exporter = {
        guard() {
            if (!state.records.length) {
                UI.toast('还没有整理到任何数据', 'err');
                return false;
            }
            return true;
        },
        /** 主推：每条一个 md，打成一个 zip 下载 */
        zip() {
            if (!this.guard()) return;
            UI.toast('正在打包 ' + state.records.length + ' 个文件…', 'ok');
            setTimeout(() => {
                try {
                    const arc = buildArchive(state.records);
                    const ok = downloadBlob(arc.dir + '.zip', arc.blob);
                    UI.toast(ok
                        ? '已打包 ' + arc.files.length + ' 个文件（' + Math.round(arc.blob.size / 1024) + ' KB）'
                        : '打包下载失败', ok ? 'ok' : 'err');
                    if (ok) UI.log('已导出 ZIP：' + arc.dir + '.zip（' + arc.files.length + ' 个文件）');
                } catch (e) {
                    console.error('[HB收藏整理] ZIP 打包失败', e);
                    UI.toast('打包失败：' + e.message, 'err');
                }
            }, 60);
        },
        md() {
            if (!this.guard()) return;
            const ok = download('小黑盒收藏-' + stamp() + '.md', renderFullMarkdown(state.records), 'text/markdown;charset=utf-8');
            UI.toast(ok ? '已导出 Markdown（' + state.records.length + ' 条）' : '导出失败', ok ? 'ok' : 'err');
        },
        json() {
            if (!this.guard()) return;
            const ok = download('小黑盒收藏-' + stamp() + '.json', JSON.stringify(state.records, null, 2), 'application/json;charset=utf-8');
            UI.toast(ok ? '已导出 JSON（' + state.records.length + ' 条）' : '导出失败', ok ? 'ok' : 'err');
        },
        csv() {
            if (!this.guard()) return;
            const ok = download('小黑盒收藏-' + stamp() + '.csv', renderCSV(state.records), 'text/csv;charset=utf-8');
            UI.toast(ok ? '已导出 CSV（' + state.records.length + ' 条）' : '导出失败', ok ? 'ok' : 'err');
        },
        copyAll() {
            if (!this.guard()) return;
            const ok = copyText(renderFullMarkdown(state.records));
            UI.toast(ok ? '已复制全部 Markdown（' + state.records.length + ' 条）' : '复制失败，请改用导出', ok ? 'ok' : 'err');
        }
    };

    // ==========================================
    // 8. 主流程
    // ==========================================
    const Runner = {
        busy: false,

        processedIds() {
            const s = new Set();
            state.records.forEach((r) => { if (r.linkId) s.add(String(r.linkId)); });
            state.failed.forEach((f) => { if (f.linkId) s.add(String(f.linkId)); });
            return s;
        },

        queue() {
            const nodes = document.querySelectorAll('.user-favour__item');
            const out = [];
            const done = this.processedIds();
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                const href = a.getAttribute('href') || '';
                const m = href.match(/\/app\/bbs\/link\/(\d+)/);
                if (!m) continue;
                const id = m[1];
                if (done.has(id)) continue;
                out.push({ id: id, el: a, url: 'https://xiaoheihe.cn/app/bbs/link/' + id });
            }
            return out;
        },

        async loadMoreList() {
            const before = document.querySelectorAll('.user-favour__item').length;
            const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            window.scrollTo(0, h);
            await sleep(1200);
            window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
            await sleep(1200);
            return document.querySelectorAll('.user-favour__item').length > before;
        },

        start() {
            if (state.running) { UI.toast('已经在运行了'); return; }
            if (!onListPage()) {
                UI.toast('请先打开「我的收藏」页面再开始', 'err');
                return;
            }
            state.running = true;
            state.startedAt = state.startedAt || Date.now();
            state.lastTick = Date.now();
            saveState();
            UI.refresh();
            UI.log('开始整理，运行中…', 'ok');
            UI.toast('开始整理');
            this.tick();
        },

        pause() {
            if (!state.running) { UI.toast('当前没有在运行'); return; }
            state.running = false;
            saveState();
            state.collapsed = false;
            saveState();
            UI.applyCollapsed();
            UI.refresh();
            UI.log('已暂停（Esc 也可暂停）', 'err');
            UI.toast('已暂停，数据已保留');
        },

        clear() {
            if (!state.records.length && !state.failed.length) { UI.toast('本来就没有数据'); return; }
            const n = state.records.length;
            state.records = [];
            state.failed = [];
            state.current = null;
            state.running = false;
            saveState();
            const box = UI.root.querySelector('.hbf-log');
            if (box) { box.textContent = '数据已清空。'; box.dataset.fresh = ''; }
            UI.refresh();
            UI.toast('已清空 ' + n + ' 条数据');
        },

        async tick() {
            if (this.busy) return;
            if (!state.running) return;
            this.busy = true;
            state.lastTick = Date.now();
            saveState();
            try {
                if (onDetailPage()) {
                    await this.handleDetail();
                } else if (onListPage()) {
                    await this.handleList();
                } else {
                    UI.log('当前不在收藏页或详情页，已停止', 'err');
                    state.running = false;
                    saveState();
                    UI.refresh();
                }
            } catch (e) {
                UI.log('运行出错：' + (e && e.message ? e.message : e), 'err');
                console.warn('[HB收藏整理]', e);
            } finally {
                this.busy = false;
            }
            if (state.running) {
                state.lastTick = Date.now();
                saveState();
            }
        },

        async handleList() {
            UI.log('扫描收藏列表…');
            let q = this.queue();
            if (!q.length) {
                UI.log('当前列表已全部处理，尝试加载更多…');
                const grew = await this.loadMoreList();
                q = this.queue();
                if (!q.length) {
                    if (grew) {
                        // 新加载出来的条目可能还在渲染，下一轮再取
                        setTimeout(() => this.tick(), 900);
                        return;
                    }
                    UI.log('没有更多可整理的条目，完成。', 'ok');
                    this.finish();
                    return;
                }
            }

            const next = q[0];
            state.current = next.id;
            saveState();
            UI.log('打开：' + next.id + (next.el.querySelector('.bbs-content__title') ? ' · ' + txt(next.el.querySelector('.bbs-content__title')).slice(0, 24) : ''));

            await delay();
            try {
                next.el.click();
            } catch (e) { /* ignore */ }

            const arrived = await waitFor(() => currentDetailId() === next.id, 8000, 250);
            if (!arrived) {
                UI.log('点击没跳转，改用直接跳转', 'err');
                location.href = next.url;
                return;
            }
            // SPA 跳转成功，等 DOM 就绪后继续
            await waitFor(() => document.querySelector('.post__content') || document.querySelector('.link-section-title'), 15000, 250);
            await sleep(400);
            setTimeout(() => this.tick(), 100);
        },

        async handleDetail() {
            const id = currentDetailId();
            if (!id) return;
            if (state.current && String(state.current) !== String(id)) {
                // 用户手动开的别的详情页，不介入
                UI.log('当前详情页不是本次任务目标，跳过', 'err');
                state.running = false;
                saveState();
                UI.refresh();
                return;
            }

            UI.log('抓取详情 ' + id + ' …');
            const ready = await waitFor(() => document.querySelector('.post__content') || document.querySelector('.link-section-title'), 15000, 250);
            if (!ready) {
                this.fail(id, '详情内容加载超时');
                await this.goBack();
                return;
            }
            await sleep(600);

            const expanded = await expandEverything((m) => UI.log(m));
            UI.log('展开后：主楼 ' + expanded.comments + ' / 回复 ' + expanded.replies);

            // 正文图片懒加载，采集前先触发出图
            await warmupImages((m) => UI.log(m));

            const record = extractDetail();
            if (!record.title) {
                this.fail(id, '没解析到标题，页面结构可能变了');
                await this.goBack();
                return;
            }

            // 去重写入
            const idx = state.records.findIndex((r) => String(r.linkId) === String(id));
            if (idx >= 0) state.records[idx] = record;
            else state.records.push(record);
            state.current = null;
            saveState();
            UI.refresh();
            UI.log('已保存：' + record.title.slice(0, 22) + '（' + record.commentCount + ' 主楼 / ' + record.replyCount + ' 回复）', 'ok');

            if (state.opts.copyEach) {
                const ok = copyText(renderMarkdown(record));
                if (!ok) UI.log('复制到剪贴板失败', 'err');
            }

            if (state.opts.removeFav) {
                const res = await cancelFavour((m) => UI.log(m));
                if (res.ok) UI.log('取消收藏：' + res.reason, 'ok');
                else {
                    UI.log('取消收藏失败：' + res.reason, 'err');
                    record.favCancelFailed = res.reason;
                    saveState();
                }
            }

            await delay();
            await this.goBack();
        },

        fail(linkId, reason) {
            const exists = state.failed.some((f) => String(f.linkId) === String(linkId));
            if (!exists) state.failed.push({ linkId: String(linkId), reason: reason, at: Date.now() });
            state.current = null;
            saveState();
            UI.refresh();
            UI.log('失败 ' + linkId + '：' + reason, 'err');
        },

        async goBack() {
            UI.log('返回列表…');
            const target = currentDetailId();
            try { history.back(); } catch (e) { /* ignore */ }
            const back = await waitFor(() => onListPage(), 6000, 250);
            if (!back) {
                location.href = FAVOUR_URL;
                return;
            }
            // SPA 返回成功：等列表渲染
            await waitFor(() => document.querySelector('.user-favour__item'), 12000, 250);
            await sleep(500);
            if (state.running) setTimeout(() => this.tick(), 150);
        },

        finish() {
            state.running = false;
            state.current = null;
            saveState();
            state.collapsed = false;
            saveState();
            UI.applyCollapsed();
            UI.refresh();
            UI.log('全部完成，共 ' + state.records.length + ' 条。', 'ok');
            UI.toast('整理完成：' + state.records.length + ' 条', 'ok');
            if (state.opts.autoZip && state.records.length) {
                setTimeout(() => Exporter.zip(), 800);
            }
            try {
                GM_notification({
                    title: '小黑盒收藏夹整理器',
                    text: '整理完成，共 ' + state.records.length + ' 条',
                    timeout: 5000
                });
            } catch (e) { /* ignore */ }
        }
    };

    // ==========================================
    // 9. 启动
    // ==========================================
    function bindHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                UI.toggle();
                return;
            }
            if (e.key === 'Escape') {
                if (state.running) {
                    e.preventDefault();
                    Runner.pause();
                }
            }
        }, true);
    }

    function boot() {
        loadState();
        UI.mount();
        bindHotkeys();

        const hasData = state.records.length > 0;
        const resumeFresh = state.running && state.lastTick && (Date.now() - state.lastTick < 120000);
        if (state.running && !resumeFresh) {
            // 隔了很久的残留运行态，不自动开跑
            state.running = false;
            saveState();
        }

        if (onListPage()) {
            UI.log('收藏页已就绪，共 ' + document.querySelectorAll('.user-favour__item').length + ' 个可见条目');
            if (hasData) UI.log('已有 ' + state.records.length + ' 条历史记录，可继续或导出');
        } else if (onDetailPage()) {
            UI.log('详情页已就绪');
        }

        if (state.running && resumeFresh) {
            UI.log('检测到未完成的整理任务，自动继续…', 'ok');
            setTimeout(() => Runner.tick(), 800);
        } else {
            UI.refresh();
        }

        try {
            GM_registerMenuCommand('小黑盒收藏整理：显示/隐藏面板', () => UI.toggle());
            GM_registerMenuCommand('小黑盒收藏整理：开始', () => Runner.start());
            GM_registerMenuCommand('小黑盒收藏整理：暂停', () => Runner.pause());
        } catch (e) { /* ignore */ }
    }

    // 调试钩子：便于在控制台核对解析结果
    try {
        window.__HBFavourOrganizer = {
            state: state,
            extractDetail: extractDetail,
            expandEverything: expandEverything,
            warmupImages: warmupImages,
            imgSrcOf: imgSrcOf,
            renderMarkdown: renderMarkdown,
            renderCSV: renderCSV,
            buildArchive: buildArchive,
            buildZip: buildZip,
            crc32: crc32,
            safeName: safeName,
            Exporter: Exporter,
            runner: Runner,
            ui: UI
        };
    } catch (e) { /* ignore */ }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
