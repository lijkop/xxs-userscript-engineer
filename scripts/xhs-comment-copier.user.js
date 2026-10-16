// ==UserScript==
// @name         小红书评论批量复制
// @name:en      Xiaohongshu Comment Copier
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  一键提取小红书笔记评论到剪贴板，支持用户名、点赞数、回复数与跟评（楼中楼），可自动展开跟评并滚动采集。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:zh-CN 一键提取小红书笔记评论到剪贴板，支持用户名、点赞数、回复数与跟评（楼中楼），可自动展开跟评并滚动采集。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:en One-click extraction of Xiaohongshu note comments to the clipboard, including username, like count and nested replies, with auto-expand and auto-scroll collection. Feedback via Telegram: https://t.me/zzyyffxx
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/xhs-comment-copier.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/xhs-comment-copier.user.js
// @match        *://*.xiaohongshu.com/explore/*
// @match        *://*.xiaohongshu.com/search_result/*
// @grant        GM_setClipboard
// @grant        GM_notification
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // 0. 选择器 —— 全部核对自小红书评论区的真实运行时 DOM
    //    （2026-10-16 采集，类名为语义类名，非构建哈希）
    // ============================================================
    const SEL = {
        container: '.comments-container',          // 评论区根
        total: '.comments-container .total',       // “共 490 条评论”
        parent: '.parent-comment',                 // 一条根评论的外层
        item: '.comment-item',                     // 评论项（根评论）
        subItem: '.comment-item-sub',              // 跟评项
        author: '.author .name',                   // 用户名
        content: '.content .note-text',            // 评论正文
        likeCount: '.interactions .like .count',   // 点赞数（0 赞时文本为“赞”）
        replyCount: '.interactions .reply .count', // 回复数（无回复时文本为“回复”）
        dateBox: '.info .date',                    // 日期 + 地区容器
        location: '.info .date .location',         // 地区
        topLabel: '.labels .top',                  // “置顶评论”
        showMore: '.show-more',                    // “展开 N 条回复”
        replyBox: '.reply-container',              // 跟评容器
        picture: '.comment-picture img'            // 评论附图
    };

    const CFG = {
        scrollStep: 700,        // 每次滚动像素
        tickInterval: 900,      // 每轮间隔（ms）
        maxRounds: 300,         // 最多滚动轮次，防死循环
        idleRounds: 6,          // 连续无新增多少轮后判定采集结束
        clickShowMore: true     // 是否自动展开“展开 N 条回复”
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // ============================================================
    // 1. 解析层
    // ============================================================
    function parseCount(raw) {
        const t = (raw || '').trim();
        // 0 赞 / 无回复时小红书显示的是“赞”“回复”文字
        if (/^\d+$/.test(t)) return Number(t);
        if (/万/.test(t)) return Math.round(parseFloat(t) * 10000) || 0;
        return 0;
    }

    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
        return 'h' + (h >>> 0).toString(36);
    }

    function parseItem(el, parentId) {
        const text = (s) => (el.querySelector(s)?.innerText || '').trim();
        const dateBox = el.querySelector(SEL.dateBox);
        const dateSpan = dateBox ? [...dateBox.querySelectorAll('span')].find((s) => !s.classList.contains('location')) : null;

        return {
            id: el.id || hash((text(SEL.author) + '|' + text(SEL.content)).slice(0, 80)),
            user: text(SEL.author) || '匿名用户',
            text: text(SEL.content),
            like: parseCount(text(SEL.likeCount)),
            reply: parseCount(text(SEL.replyCount)),
            date: (dateSpan?.innerText || '').trim(),
            location: text(SEL.location),
            isTop: !!el.querySelector(SEL.topLabel),
            isSub: el.classList.contains('comment-item-sub'),
            parentId: parentId || null,
            pictures: [...el.querySelectorAll(SEL.picture)].map((img) => img.src).filter(Boolean)
        };
    }

    // ============================================================
    // 2. 数据层
    // ============================================================
    const Store = {
        map: new Map(),

        upsert(c) {
            const existed = this.map.has(c.id);
            this.map.set(c.id, c);          // 已存在的更新（点赞数会变），但不算新增
            return !existed;
        },

        collect() {
            let added = 0;
            const parents = document.querySelectorAll(SEL.parent);

            if (parents.length) {
                parents.forEach((pc) => {
                    const main = pc.querySelector(':scope > ' + SEL.item);
                    if (main) {
                        if (this.upsert(parseItem(main, null))) added++;
                    }
                    pc.querySelectorAll(SEL.replyBox + ' ' + SEL.item).forEach((sub) => {
                        if (this.upsert(parseItem(sub, main ? main.id : null))) added++;
                    });
                });
            } else {
                // 兜底：结构变化时至少别丢数据
                document.querySelectorAll(SEL.item).forEach((el) => {
                    if (this.upsert(parseItem(el, null))) added++;
                });
            }
            return added;
        },

        roots() {
            return [...this.map.values()].filter((c) => !c.isSub);
        },

        childrenOf(id) {
            return [...this.map.values()].filter((c) => c.parentId === id);
        },

        stats() {
            const all = [...this.map.values()];
            const subs = all.filter((c) => c.isSub).length;
            return { total: all.length, roots: all.length - subs, subs };
        },

        clear() {
            this.map.clear();
        }
    };

    // ============================================================
    // 3. 页面适配层（滚动 / 展开跟评 / 总数）
    // ============================================================
    const Adapter = {
        getTotal() {
            const raw = document.querySelector(SEL.total)?.innerText || '';
            const m = raw.match(/([\d.]+)\s*万?/);
            if (!m) return 0;
            return /万/.test(raw) ? Math.round(parseFloat(m[1]) * 10000) : Number(m[1]);
        },

        /** 小红书评论区是独立滚动容器，滚 window 无效，这里向上找可滚动祖先 */
        findScroller() {
            let n = document.querySelector(SEL.container);
            while (n && n !== document.body && n !== document.documentElement) {
                const oy = getComputedStyle(n).overflowY;
                if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 40) return n;
                n = n.parentElement;
            }
            return document.scrollingElement || document.documentElement;
        },

        /** 点击所有“展开 N 条回复”，加载被折叠的跟评 */
        expandReplies() {
            if (!CFG.clickShowMore) return 0;
            let clicked = 0;
            document.querySelectorAll(SEL.showMore).forEach((btn) => {
                if (btn.dataset.xxsClicked) return;
                if (!/展开\s*\d+\s*条回复/.test(btn.innerText || '')) return;
                btn.dataset.xxsClicked = '1';
                btn.click();
                clicked++;
            });
            return clicked;
        }
    };

    // ============================================================
    // 4. 采集引擎
    // ============================================================
    const Engine = {
        running: false,
        round: 0,

        start(onProgress) {
            if (this.running) return;
            this.running = true;
            this.loop(onProgress);
        },

        stop() {
            this.running = false;
        },

        async loop(onProgress) {
            let idle = 0;
            this.round = 0;
            const total = Adapter.getTotal();

            while (this.running && this.round < CFG.maxRounds) {
                this.round++;

                Adapter.expandReplies();
                const added = Store.collect();

                const sc = Adapter.findScroller();
                const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 12;
                sc.scrollTop = Math.min(sc.scrollTop + CFG.scrollStep, sc.scrollHeight);

                onProgress(Store.stats(), total, this.round);

                await sleep(CFG.tickInterval);
                if (!this.running) break;

                Store.collect();

                if (added === 0) idle++; else idle = 0;

                // 已经到底且连续多轮没有新内容 → 结束
                if (atBottom && idle >= CFG.idleRounds) break;
            }

            this.running = false;
            onProgress(Store.stats(), total, this.round, true);
        }
    };

    // ============================================================
    // 5. 导出格式
    // ============================================================
    const Exporter = {
        markdown() {
            const s = Store.stats();
            const total = Adapter.getTotal();
            const lines = [
                '# 小红书笔记评论',
                '',
                `> 页面显示共 ${total || '?'} 条 · 已采集 ${s.total} 条（根评论 ${s.roots} / 跟评 ${s.subs}）· 导出于 ${new Date().toLocaleString()}`,
                ''
            ];

            Store.roots().forEach((c, i) => {
                const flags = [c.isTop ? '📌 置顶' : '', c.location, c.date].filter(Boolean).join(' · ');
                lines.push(`## ${i + 1}. ${c.user}`);
                lines.push(`👍 ${c.like} · 💬 ${c.reply}${flags ? ' · ' + flags : ''}`);
                lines.push('');
                lines.push(c.text || '（无正文）');
                if (c.pictures.length) lines.push(`（附图 ${c.pictures.length} 张）`);
                lines.push('');

                const kids = Store.childrenOf(c.id);
                if (kids.length) {
                    kids.forEach((k) => {
                        const kFlags = [k.location, k.date].filter(Boolean).join(' · ');
                        lines.push(`- **${k.user}** 👍${k.like}${kFlags ? ' · ' + kFlags : ''}：${k.text || '（无正文）'}`);
                    });
                    lines.push('');
                }
            });

            return lines.join('\n');
        },

        plain() {
            const rows = ['层级\t用户名\t点赞\t回复数\t时间\t地区\t内容\t置顶'];
            Store.roots().forEach((c) => {
                rows.push(`根评论\t${c.user}\t${c.like}\t${c.reply}\t${c.date}\t${c.location}\t${c.text.replace(/\t/g, ' ')}\t${c.isTop ? '是' : ''}`);
                Store.childrenOf(c.id).forEach((k) => {
                    rows.push(`　└ 跟评\t${k.user}\t${k.like}\t${k.reply}\t${k.date}\t${k.location}\t${k.text.replace(/\t/g, ' ')}\t`);
                });
            });
            return rows.join('\n');
        }
    };

    // ============================================================
    // 6. UI（Shadow DOM 隔离，绘制不污染页面）
    // ============================================================
    const UI = {
        host: null,
        root: null,
        el: {},

        mount() {
            this.host = document.createElement('div');
            this.host.id = 'xxs-xhs-copier';
            this.root = this.host.attachShadow({ mode: 'open' });
            this.root.appendChild(this.style());
            this.root.appendChild(this.template());
            document.body.appendChild(this.host);
            this.bind();
            this.refresh();
        },

        style() {
            const css = `
                :host { all: initial; }
                * { box-sizing: border-box; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; }

                #ball {
                    position: fixed; right: 22px; bottom: 96px; width: 52px; height: 52px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 50%; cursor: pointer; z-index: 2147483000;
                    color: #fff; font-size: 13px; font-weight: 600; letter-spacing: .5px;
                    background: linear-gradient(135deg, #ff5c7a 0%, #ff2442 100%);
                    box-shadow: 0 6px 18px rgba(255, 36, 66, .38);
                    transition: transform .18s ease, box-shadow .18s ease;
                    user-select: none;
                }
                #ball:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 10px 22px rgba(255, 36, 66, .45); }
                #ball:active { transform: scale(.97); }

                #badge {
                    position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px;
                    display: flex; align-items: center; justify-content: center;
                    background: #1f2329; color: #fff; font-size: 11px; font-weight: 600;
                    border-radius: 10px; border: 2px solid #fff;
                }

                #panel {
                    position: fixed; right: 22px; bottom: 162px; width: 286px;
                    background: #fff; color: #1f2329;
                    border: 1px solid rgba(0,0,0,.06); border-radius: 14px;
                    box-shadow: 0 16px 40px rgba(0,0,0,.16);
                    padding: 14px; z-index: 2147482999;
                    opacity: 0; transform: translateY(8px) scale(.98); pointer-events: none;
                    transition: opacity .18s ease, transform .18s ease;
                }
                #panel.show { opacity: 1; transform: none; pointer-events: auto; }

                .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
                .head h1 { margin: 0; font-size: 14px; font-weight: 600; }
                .head span { font-size: 11px; color: #9aa0a6; }

                .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
                .stat { background: #f7f8fa; border-radius: 8px; padding: 7px 6px; text-align: center; }
                .stat b { display: block; font-size: 16px; font-weight: 600; color: #ff2442; line-height: 1.3; }
                .stat i { font-style: normal; font-size: 11px; color: #8a9099; }

                .bar { height: 4px; background: #f0f1f3; border-radius: 2px; overflow: hidden; margin-bottom: 10px; }
                .bar > i { display: block; height: 100%; width: 0; background: linear-gradient(90deg,#ff5c7a,#ff2442); transition: width .3s ease; }

                .row { display: flex; gap: 6px; margin-bottom: 6px; }
                button {
                    flex: 1; padding: 8px 10px; font-size: 12.5px; cursor: pointer;
                    border: 1px solid transparent; border-radius: 8px; transition: background .15s ease, opacity .15s ease;
                }
                .primary { background: #ff2442; color: #fff; }
                .primary:hover { background: #e91e3c; }
                .primary.stop { background: #1f2329; }
                .ghost { background: #f2f3f5; color: #1f2329; }
                .ghost:hover { background: #e8eaed; }
                .link { background: transparent; color: #9aa0a6; font-size: 11.5px; padding: 4px; }
                .link:hover { color: #ff2442; }
                .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }

                .hint { font-size: 11px; color: #9aa0a6; line-height: 1.5; margin-top: 6px; }

                @media (prefers-color-scheme: dark) {
                    #panel { background: #23262b; color: #e8eaed; border-color: rgba(255,255,255,.08); }
                    .stat { background: #2c3036; }
                    .stat i, .head span, .hint, .link { color: #9aa0a6; }
                    .ghost { background: #2c3036; color: #e8eaed; }
                    .ghost:hover { background: #363b42; }
                    #badge { border-color: #23262b; }
                }
            `;
            const s = document.createElement('style');
            s.textContent = css;
            return s;
        },

        template() {
            const wrap = document.createElement('div');
            wrap.innerHTML = `
                <div id="ball">评论<span id="badge">0</span></div>
                <div id="panel">
                    <div class="head">
                        <h1>评论采集</h1>
                        <span id="page-total"></span>
                    </div>
                    <div class="stats">
                        <div class="stat"><b id="n-root">0</b><i>根评论</i></div>
                        <div class="stat"><b id="n-sub">0</b><i>跟评</i></div>
                        <div class="stat"><b id="n-all">0</b><i>合计</i></div>
                    </div>
                    <div class="bar"><i id="progress"></i></div>
                    <div class="row">
                        <button class="primary" id="btn-run">开始采集</button>
                        <button class="ghost" id="btn-stop">停止</button>
                    </div>
                    <div class="row">
                        <button class="ghost" id="btn-md">复制 Markdown</button>
                        <button class="ghost" id="btn-txt">复制纯文本</button>
                    </div>
                    <div class="foot">
                        <button class="link" id="btn-clear">清空</button>
                        <button class="link" id="btn-diag">自检选择器</button>
                    </div>
                    <div class="hint" id="hint">点「开始采集」会自动展开跟评并向下滚动，直到没有新评论为止。</div>
                </div>
            `;
            return wrap;
        },

        bind() {
            const $ = (id) => this.root.getElementById(id);
            this.el = {
                ball: $('ball'), badge: $('badge'), panel: $('panel'),
                pageTotal: $('page-total'), nRoot: $('n-root'), nSub: $('n-sub'), nAll: $('n-all'),
                progress: $('progress'), run: $('btn-run'), stop: $('btn-stop'),
                md: $('btn-md'), txt: $('btn-txt'), clear: $('btn-clear'), diag: $('btn-diag'), hint: $('hint')
            };

            this.el.ball.onclick = () => this.el.panel.classList.toggle('show');

            this.el.run.onclick = () => {
                Engine.start((stats, total, round, done) => this.refresh(stats, total, round, done));
                this.el.run.classList.add('stop');
                this.el.run.innerText = '采集中…';
                this.el.hint.innerText = '正在展开跟评并滚动采集，请保持页面打开。';
            };

            this.el.stop.onclick = () => {
                Engine.stop();
                this.el.hint.innerText = '已停止。可以复制当前已采集的内容。';
                this.resetRunBtn();
            };

            this.el.md.onclick = () => this.copy(Exporter.markdown(), 'Markdown');
            this.el.txt.onclick = () => this.copy(Exporter.plain(), '纯文本');

            this.el.clear.onclick = () => {
                Store.clear();
                this.refresh();
                this.el.hint.innerText = '已清空当前采集结果。';
            };

            this.el.diag.onclick = () => this.diagnose();
        },

        resetRunBtn() {
            this.el.run.classList.remove('stop');
            this.el.run.innerText = '开始采集';
        },

        copy(content, label) {
            if (!Store.map.size) {
                this.el.hint.innerText = '还没有采集到评论，先点「开始采集」。';
                return;
            }
            GM_setClipboard(content, 'text');
            GM_notification({
                title: '小红书评论采集',
                text: `已复制 ${Store.map.size} 条评论（${label}）到剪贴板`,
                timeout: 2500
            });
            this.el.hint.innerText = `已复制 ${Store.map.size} 条到剪贴板（${label}）。`;
        },

        refresh(stats, total, round, done) {
            const s = stats || Store.stats();
            const pageTotal = total || Adapter.getTotal();
            this.el.badge.innerText = s.total > 999 ? '999+' : String(s.total);
            this.el.nRoot.innerText = s.roots;
            this.el.nSub.innerText = s.subs;
            this.el.nAll.innerText = s.total;
            this.el.pageTotal.innerText = pageTotal ? `页面共 ${pageTotal} 条` : '';
            this.el.progress.style.width = pageTotal ? Math.min(100, (s.total / pageTotal) * 100) + '%' : '0%';

            if (done) {
                this.resetRunBtn();
                this.el.hint.innerText = `采集结束：共 ${s.total} 条（根评论 ${s.roots} / 跟评 ${s.subs}）。可以复制了。`;
            } else if (round) {
                this.el.hint.innerText = `第 ${round} 轮 · 已采集 ${s.total} 条，继续向下滚动…`;
            }
        },

        /** 选择器自检：把每个选择器的命中数量打出来，页面改版时一眼看出坏在哪 */
        diagnose() {
            const rows = Object.entries(SEL).map(([k, v]) => [k, v, document.querySelectorAll(v).length]);
            // eslint-disable-next-line no-console
            console.table(rows.map(([k, v, n]) => ({ key: k, selector: v, hits: n })));
            const bad = rows.filter(([, , n]) => n === 0).map(([k]) => k);
            this.el.hint.innerText = bad.length
                ? `以下选择器没命中，页面可能改版：${bad.join('、')}（详见 Console）`
                : '选择器自检通过，全部有命中。';
        }
    };

    // ============================================================
    // 7. 启动：等评论区渲染出来再挂 UI
    // ============================================================
    (function boot() {
        let tries = 0;
        const timer = setInterval(() => {
            tries++;
            if (document.querySelector(SEL.container) || tries > 60) {
                clearInterval(timer);
                UI.mount();
                Store.collect();
                UI.refresh();
            }
        }, 500);

        // 页面内评论动态加载时静默收集，用户手动滚动也不丢
        const observer = new MutationObserver(() => {
            if (!UI.host) return;
            const added = Store.collect();
            if (added) UI.refresh();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
})();
