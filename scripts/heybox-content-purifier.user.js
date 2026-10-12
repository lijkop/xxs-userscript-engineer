// ==UserScript==
// @name         小黑盒内容净化器
// @name:en      HeyBox Content Purifier
// @namespace    https://heybox.com/
// @version      4.1.2
// @description  小黑盒论坛内容过滤：按关键词、零赞零评、分区过滤帖子，并净化评论区（插眼、关键词、纯表情、楼中楼）。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:zh-CN 小黑盒论坛内容过滤：按关键词、零赞零评、分区过滤帖子，并净化评论区（插眼、关键词、纯表情、楼中楼）。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:en Filter Xiaoheihe forum: posts by keyword, zero engagement or section, plus comment cleanup (bookmark replies, keywords, emoji-only, nested replies). Feedback via Telegram: https://t.me/zzyyffxx
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/heybox-content-purifier.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/heybox-content-purifier.user.js
// @match        https://*.xiaoheihe.cn/app/bbs/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 1. 配置中心
    // ==========================================
    const Config = {
        data: {
            postKeywords: [],      // 标题/内容屏蔽词
            partitionKeywords: [], // 分区屏蔽词 (如：盒友杂谈)
            commentKeywords: ["副屏", "插眼", "cy", "攻略"],
            blockZeroComment: false,
            blockZeroLike: false,
            blockPureEmoji: false,
            hideMode: 'remove',
            stats: { postsBlocked: 0, commentsBlocked: 0 }
        },
        load() {
            const saved = GM_getValue('hb_ultimate_config_v4_1');
            if (saved) {
                this.data = { ...this.data, ...JSON.parse(saved) };
            }
        },
        save() {
            GM_setValue('hb_ultimate_config_v4_1', JSON.stringify(this.data));
            UI.updateStats();
        }
    };

    // ==========================================
    // 2. 核心引擎
    // ==========================================
    const Engine = {
        debounceTimer: null,

        run() {
            this.filterPosts();
            this.filterComments();
        },

        filterPosts() {
            const posts = document.querySelectorAll('a.hb-cpt__bbs-content');
            let newlyBlocked = 0;

            posts.forEach(post => {
                if (post.dataset.hbProcessed === Config.data.hideMode) return;

                // 提取数据
                const title = post.querySelector('.bbs-content__title')?.innerText || '';
                const content = post.querySelector('.bbs-content__content')?.innerText || '';
                const partition = post.querySelector('.content-tag-text')?.innerText || ''; // 识别分区
                const text = (title + content).toLowerCase();

                const commentEl = post.querySelector('.content-list__comment-cnt');
                const likeEl = post.querySelector('.content-list__like-cnt');
                const comments = commentEl ? parseInt(commentEl.textContent.replace(/[^0-9]/g, '') || '0', 10) : -1;
                const likes = likeEl ? parseInt(likeEl.textContent.replace(/[^0-9]/g, '') || '0', 10) : -1;

                let shouldBlock = false;

                // 规则1：分区屏蔽
                if (Config.data.partitionKeywords.length > 0) {
                    shouldBlock = Config.data.partitionKeywords.some(k => partition.includes(k));
                }
                // 规则2：标题/内容关键词
                if (!shouldBlock && Config.data.postKeywords.length > 0) {
                    shouldBlock = Config.data.postKeywords.some(k => text.includes(k.toLowerCase()));
                }
                // 规则3：0赞0评
                if (!shouldBlock && Config.data.blockZeroComment && comments === 0) shouldBlock = true;
                if (!shouldBlock && Config.data.blockZeroLike && likes === 0) shouldBlock = true;

                if (shouldBlock) {
                    if (!post.dataset.hbBlocked) newlyBlocked++;
                    post.dataset.hbBlocked = 'true';
                    post.dataset.hbProcessed = Config.data.hideMode;

                    if (Config.data.hideMode === 'remove') {
                        post.style.display = 'none';
                    } else {
                        post.style.display = '';
                        post.style.opacity = '0.1';
                        post.style.pointerEvents = 'none';
                    }
                } else {
                    post.dataset.hbBlocked = 'false';
                    post.dataset.hbProcessed = '';
                    post.style.display = '';
                    post.style.opacity = '1';
                    post.style.pointerEvents = 'auto';
                }
            });

            if (newlyBlocked > 0) {
                Config.data.stats.postsBlocked += newlyBlocked;
                Config.save();
            }
        },

        filterComments() {
            let newlyBlocked = 0;
            const selectors = '.comment-item__content, .children-item__comment-content';

            document.querySelectorAll(selectors).forEach(content => {
                const commentWrapper = content.closest('.link-comment__comment-item') || content.closest('.comment-children-item');
                if (!commentWrapper || commentWrapper.dataset.hbProcessed === 'true') return;

                const text = (content.innerText || "").trim();
                const hasText = text.length > 0;
                let shouldBlock = false;

                if (content.classList.contains('cy')) shouldBlock = true;
                if (!shouldBlock && Config.data.commentKeywords.length > 0) {
                    shouldBlock = Config.data.commentKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()));
                }
                if (!shouldBlock && Config.data.blockPureEmoji && !hasText) shouldBlock = true;

                if (shouldBlock) {
                    commentWrapper.style.display = 'none';
                    commentWrapper.dataset.hbProcessed = 'true';
                    newlyBlocked++;
                }
            });

            if (newlyBlocked > 0) {
                Config.data.stats.commentsBlocked += newlyBlocked;
                Config.save();
            }
        },

        observe() {
            const observer = new MutationObserver(() => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => this.run(), 300);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        },

        refreshAll() {
            document.querySelectorAll('a.hb-cpt__bbs-content').forEach(p => {
                p.dataset.hbProcessed = '';
                p.style.display = '';
                p.style.opacity = '1';
                p.style.pointerEvents = 'auto';
            });
            document.querySelectorAll('.link-comment__comment-item, .comment-children-item').forEach(c => {
                c.dataset.hbProcessed = '';
                c.style.display = '';
            });
            this.run();
        }
    };

    // ==========================================
    // 3. UI控制器
    // ==========================================
    const UI = {
        shadowRoot: null,

        init() {
            const host = document.createElement('div');
            host.id = 'hb-ultimate-host';
            document.body.appendChild(host);
            this.shadowRoot = host.attachShadow({ mode: 'open' });

            this.render();
            this.bindEvents();
            this.makeDraggable();

            GM_registerMenuCommand("⚙️ 净化设置", () => {
                this.togglePanel(true);
            });
        },

        togglePanel(show) {
            const panel = this.shadowRoot.querySelector('#panel');
            const trigger = this.shadowRoot.querySelector('#trigger');
            panel.style.display = show ? 'flex' : 'none';
            trigger.style.display = show ? 'none' : 'flex';
        },

        render() {
            const style = `
                <style>
                    :host { all: initial; }
                    #panel { position: fixed; bottom: 30px; right: 30px; width: 320px; background: #fff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); font-family: sans-serif; z-index: 2147483647; overflow: hidden; display: none; flex-direction: column; }
                    .header { background: #1a1a1a; color: #fff; padding: 12px 16px; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none; }
                    .header h3 { margin: 0; font-size: 14px; font-weight: 600; }
                    .close-btn { cursor: pointer; font-size: 16px; opacity: 0.7; }
                    .body { padding: 16px; font-size: 13px; color: #333; max-height: 550px; overflow-y: auto; }
                    .section { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px dashed #eee; }
                    .section:last-child { border-bottom: none; }
                    .section-title { font-weight: bold; margin-bottom: 10px; color: #1890ff; font-size: 13px; display: flex; align-items: center; gap: 4px;}
                    .section-title::before { content: ''; display: inline-block; width: 3px; height: 12px; background: #1890ff; border-radius: 2px; }
                    .row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
                    input[type="text"] { width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; margin-bottom: 8px; font-size: 12px; }
                    .tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; }
                    .tag { background: #f0f0f0; padding: 2px 8px; border-radius: 12px; font-size: 11px; display: flex; align-items: center; gap: 4px; }
                    .tag span { cursor: pointer; color: #ff4d4f; font-weight: bold; }
                    .switch { position: relative; display: inline-block; width: 34px; height: 20px; }
                    .switch input { opacity: 0; width: 0; height: 0; }
                    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px; }
                    .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
                    input:checked + .slider { background-color: #1890ff; }
                    input:checked + .slider:before { transform: translateX(14px); }
                    select { padding: 4px; border-radius: 4px; border: 1px solid #ddd; font-size: 12px; }
                    .stats { font-size: 11px; color: #888; text-align: center; margin-top: 10px; background: #f9f9f9; padding: 8px; border-radius: 6px; }
                    #trigger { position: fixed; bottom: 30px; right: 30px; width: 44px; height: 44px; background: #1a1a1a; color: #fff; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 2147483646; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: transform 0.2s; font-size: 20px; }
                </style>
            `;

            const getTagsHTML = (arr, type) => arr.map(k => `<div class="tag">${k} <span data-word="${k}" data-type="${type}">×</span></div>`).join('');

            const html = `
                ${style}
                <div id="trigger">🛡️</div>
                <div id="panel">
                    <div class="header">
                        <h3>终极净化引擎 V4.1</h3>
                        <div class="close-btn" id="hide-panel">✕</div>
                    </div>
                    <div class="body">
                        <div class="section">
                            <div class="section-title">分区过滤 (如: 盒友杂谈)</div>
                            <input type="text" id="kw-part-input" placeholder="输入分区全称回车...">
                            <div class="tag-cloud" id="kw-part-list">${getTagsHTML(Config.data.partitionKeywords, 'partition')}</div>
                        </div>

                        <div class="section">
                            <div class="section-title">帖子内容过滤</div>
                            <input type="text" id="kw-post-input" placeholder="输入内容屏蔽词回车...">
                            <div class="tag-cloud" id="kw-post-list">${getTagsHTML(Config.data.postKeywords, 'post')}</div>
                            <div style="margin-top: 10px;">
                                <div class="row"><span>屏蔽 0 评论</span> <label class="switch"><input type="checkbox" id="chk-0-comment" ${Config.data.blockZeroComment ? 'checked' : ''}><span class="slider"></span></label></div>
                                <div class="row"><span>屏蔽 0 点赞</span> <label class="switch"><input type="checkbox" id="chk-0-like" ${Config.data.blockZeroLike ? 'checked' : ''}><span class="slider"></span></label></div>
                                <div class="row"><span>处理模式</span>
                                    <select id="sel-mode">
                                        <option value="remove" ${Config.data.hideMode === 'remove' ? 'selected' : ''}>完全隐藏</option>
                                        <option value="dim" ${Config.data.hideMode === 'dim' ? 'selected' : ''}>极度虚化</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <div class="section-title">评论区过滤</div>
                            <input type="text" id="kw-comment-input" placeholder="输入评论屏蔽词回车...">
                            <div class="tag-cloud" id="kw-comment-list">${getTagsHTML(Config.data.commentKeywords, 'comment')}</div>
                            <div class="row" style="margin-top:8px"><span>屏蔽纯表情/空评论</span> <label class="switch"><input type="checkbox" id="chk-pure-emoji" ${Config.data.blockPureEmoji ? 'checked' : ''}><span class="slider"></span></label></div>
                        </div>

                        <div class="stats">
                            已净化：帖子 <b id="stat-posts">${Config.data.stats.postsBlocked}</b> ｜ 评论 <b id="stat-comments">${Config.data.stats.commentsBlocked}</b>
                        </div>
                    </div>
                </div>
            `;
            this.shadowRoot.innerHTML = html;
        },

        bindEvents() {
            const root = this.shadowRoot;

            root.getElementById('hide-panel').onclick = () => this.togglePanel(false);
            root.getElementById('trigger').onclick = () => this.togglePanel(true);

            const setupInput = (inputId, targetKey, type) => {
                const input = root.getElementById(inputId);
                input.onkeypress = (e) => {
                    if (e.key === 'Enter' && input.value.trim()) {
                        const word = input.value.trim();
                        if (!Config.data[targetKey].includes(word)) {
                            Config.data[targetKey].push(word);
                            Config.save();
                            this.refreshTags();
                            Engine.refreshAll();
                        }
                        input.value = '';
                    }
                };
            };

            setupInput('kw-part-input', 'partitionKeywords', 'partition');
            setupInput('kw-post-input', 'postKeywords', 'post');
            setupInput('kw-comment-input', 'commentKeywords', 'comment');

            root.addEventListener('click', (e) => {
                if (e.target.tagName === 'SPAN' && e.target.dataset.word) {
                    const { word, type } = e.target.dataset;
                    const map = { partition: 'partitionKeywords', post: 'postKeywords', comment: 'commentKeywords' };
                    Config.data[map[type]] = Config.data[map[type]].filter(k => k !== word);
                    Config.save();
                    this.refreshTags();
                    Engine.refreshAll();
                }
            });

            const bindToggle = (id, key) => {
                root.getElementById(id).onchange = (e) => {
                    Config.data[key] = e.target.checked;
                    Config.save();
                    Engine.refreshAll();
                };
            };
            bindToggle('chk-0-comment', 'blockZeroComment');
            bindToggle('chk-0-like', 'blockZeroLike');
            bindToggle('chk-pure-emoji', 'blockPureEmoji');

            root.getElementById('sel-mode').onchange = (e) => {
                Config.data.hideMode = e.target.value;
                Config.save();
                Engine.refreshAll();
            };
        },

        refreshTags() {
            const getHTML = (arr, type) => arr.map(k => `<div class="tag">${k} <span data-word="${k}" data-type="${type}">×</span></div>`).join('');
            this.shadowRoot.getElementById('kw-part-list').innerHTML = getHTML(Config.data.partitionKeywords, 'partition');
            this.shadowRoot.getElementById('kw-post-list').innerHTML = getHTML(Config.data.postKeywords, 'post');
            this.shadowRoot.getElementById('kw-comment-list').innerHTML = getHTML(Config.data.commentKeywords, 'comment');
        },

        updateStats() {
            if (!this.shadowRoot) return;
            this.shadowRoot.getElementById('stat-posts').innerText = Config.data.stats.postsBlocked;
            this.shadowRoot.getElementById('stat-comments').innerText = Config.data.stats.commentsBlocked;
        },

        makeDraggable() {
            const panel = this.shadowRoot.getElementById('panel');
            const header = this.shadowRoot.querySelector('.header');
            let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

            header.onmousedown = (e) => {
                initialX = e.clientX - xOffset; initialY = e.clientY - yOffset;
                if (e.target === header || e.target.tagName === 'H3') isDragging = true;
            };
            window.onmouseup = () => isDragging = false;
            window.onmousemove = (e) => {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX - initialX; currentY = e.clientY - initialY;
                    xOffset = currentX; yOffset = currentY;
                    panel.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
                }
            };
        }
    };

    const Boot = () => {
        Config.load();
        UI.init();
        Engine.run();
        Engine.observe();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', Boot);
    } else {
        Boot();
    }
})();
