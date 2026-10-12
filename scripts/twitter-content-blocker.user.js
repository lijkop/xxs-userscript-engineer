// ==UserScript==
// @name         X (Twitter) 内容屏蔽器
// @name:en      X (Twitter) Content Blocker
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  按关键词、用户名与互动数（如零评论）隐藏 X/Twitter 上的推文与回复，隐藏后不残留空白。
// @description:en Hide tweets and replies on X/Twitter by keyword, username and engagement (e.g. zero comments), leaving no blank gaps.
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/twitter-content-blocker.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/twitter-content-blocker.user.js
// @match        *://*.twitter.com/*
// @match        *://*.x.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 0. 注入底层净化样式 ---
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            div[data-testid="cellInnerDiv"][data-ts-spam="true"],
            article[data-ts-spam="true"] {
                display: none !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(style);
    };

    // 架构模式：模块化 + 配置驱动 + 观察者模式
    const App = (() => {
        // --- 1. 配置中心 (自动持久化) ---
        const Config = {
            data: {
                enabled: true,
                rules: {
                    nickname: ['抽奖', '推广', '外围'],
                    tweet: ['#广告', '博彩', '电报群'],
                    comment: ['互fo', '互赞', '主页联系'],
                    hideZeroComments: false // 新增：是否屏蔽0评论的推文
                },
                stats: { blockedCount: 0 }
            },
            load() {
                const stored = GM_getValue('x_block_config');
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        // 合并旧配置，确保新增字段不报错
                        this.data = { ...this.data, ...parsed };
                        this.data.rules = { ...this.data.rules, ...(parsed.rules || {}) };
                    } catch(e) {}
                }
            },
            save() {
                GM_setValue('x_block_config', JSON.stringify(this.data));
            }
        };

        // --- 2. 核心引擎 (防抖侦听、处理 React DOM 复用) ---
        const Engine = {
            observer: null,
            isProcessing: false,

            // 检查文本是否包含任意关键词
            matchRule(text, keywords) {
                if (!text || !keywords || keywords.length === 0) return null;
                const lowerText = text.toLowerCase();
                for (let kw of keywords) {
                    if (kw.trim() !== '' && lowerText.includes(kw.trim().toLowerCase())) {
                        return kw.trim();
                    }
                }
                return null;
            },

            // 识别是否为评论 (处于 /status/ 页面且不是顶部主推文)
            isComment(tweetNode) {
                return window.location.pathname.includes('/status/') &&
                       tweetNode.closest('[data-testid="cellInnerDiv"]') &&
                       tweetNode.closest('[data-testid="cellInnerDiv"]').previousElementSibling !== null;
            },

            processTweets() {
                if (!Config.data.enabled) return;

                const tweets = document.querySelectorAll('article[data-testid="tweet"]');
                if (tweets.length === 0) return;

                tweets.forEach(tweet => {
                    // 获取唯一标识符以应对 React DOM 复用
                    const timeEl = tweet.querySelector('time');
                    const linkEl = timeEl ? timeEl.closest('a') : null;
                    const tweetId = linkEl ? linkEl.href : (tweet.textContent.length + '-' + tweet.textContent.substring(0, 20));

                    if (tweet.dataset.tsId === tweetId) return;
                    tweet.dataset.tsId = tweetId;

                    // 获取内容
                    const nameEl = tweet.querySelector('[data-testid="User-Name"]');
                    const textEl = tweet.querySelector('[data-testid="tweetText"]');
                    const nameStr = nameEl ? nameEl.textContent : '';
                    const textStr = textEl ? textEl.textContent : '';
                    const isReply = this.isComment(tweet);

                    // 解析评论数 (Twitter中，如果是0评论，回复按钮的文本为空)
                    let replyCount = -1; // 默认-1防止DOM未加载时误判
                    const replyBtn = tweet.querySelector('[data-testid="reply"]');
                    if (replyBtn) {
                        const countText = replyBtn.textContent.trim();
                        replyCount = countText === '' ? 0 : 1;
                    }

                    let isSpam = false;

                    // 优先级判定
                    if (this.matchRule(nameStr, Config.data.rules.nickname)) {
                        isSpam = true;
                    } else if (isReply && this.matchRule(textStr, Config.data.rules.comment)) {
                        isSpam = true;
                    } else if (!isReply && this.matchRule(textStr, Config.data.rules.tweet)) {
                        isSpam = true;
                    } else if (!isReply && Config.data.rules.hideZeroComments && replyCount === 0) {
                        // 新增：仅在不是评论（主推文）且0评论时触发拦截
                        isSpam = true;
                    }

                    // 获取最外层容器
                    const wrapper = tweet.closest('[data-testid="cellInnerDiv"]') || tweet;

                    if (isSpam) {
                        wrapper.setAttribute('data-ts-spam', 'true');
                        if (!wrapper.dataset.tsCounted) {
                            Config.data.stats.blockedCount++;
                            UI.updateStats();
                            wrapper.dataset.tsCounted = 'true';
                        }
                    } else {
                        // 正常推文，必须移除属性，防止DOM回收污染
                        wrapper.removeAttribute('data-ts-spam');
                        wrapper.removeAttribute('data-ts-Counted');
                    }
                });
            },

            observe() {
                this.observer = new MutationObserver(() => {
                    if (this.isProcessing) return;
                    this.isProcessing = true;
                    requestAnimationFrame(() => {
                        this.processTweets();
                        this.isProcessing = false;
                    });
                });
                this.observer.observe(document.body, { childList: true, subtree: true });
            },

            reRun() {
                // 配置改变时，清除所有追踪标记并重新扫描页面
                document.querySelectorAll('article[data-testid="tweet"]').forEach(el => {
                    delete el.dataset.tsId;
                });
                this.processTweets();
            }
        };

        // --- 3. UI控制器 (Shadow DOM 隔离) ---
        const UI = {
            shadow: null,

            init() {
                const host = document.createElement('div');
                host.id = 'ts-x-blocker-host';
                document.body.appendChild(host);
                this.shadow = host.attachShadow({ mode: 'open' });
                this.render();
                this.bindEvents();
            },

            render() {
                this.shadow.innerHTML = `
                    <style>
                        :host {
                            --primary: #1d9bf0;
                            --bg: #15202b;
                            --panel-bg: #22303c;
                            --text: #ffffff;
                            --border: #38444d;
                        }
                        /* 悬浮球 */
                        .fab {
                            position: fixed;
                            bottom: 24px;
                            right: 24px;
                            width: 50px;
                            height: 50px;
                            background: var(--primary);
                            color: white;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            z-index: 999999;
                            font-size: 24px;
                            user-select: none;
                            transition: transform 0.2s;
                        }
                        .fab:hover { transform: scale(1.05); }

                        /* 面板 */
                        .panel {
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%) scale(0.95);
                            width: 400px;
                            background: var(--panel-bg);
                            border: 1px solid var(--border);
                            border-radius: 16px;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                            z-index: 1000000;
                            display: none;
                            flex-direction: column;
                            opacity: 0;
                            transition: all 0.2s ease-out;
                            color: var(--text);
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        }
                        .panel.show {
                            display: flex;
                            opacity: 1;
                            transform: translate(-50%, -50%) scale(1);
                        }

                        .header {
                            padding: 16px 20px;
                            border-bottom: 1px solid var(--border);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            font-weight: bold;
                            font-size: 18px;
                        }
                        .close-btn { cursor: pointer; color: #8899a6; font-size: 20px; }
                        .close-btn:hover { color: white; }

                        .content { padding: 20px; }

                        .form-group { margin-bottom: 12px; }
                        .form-group label { display: block; margin-bottom: 8px; font-size: 14px; color: #8899a6; }
                        .form-group textarea {
                            width: 100%;
                            box-sizing: border-box;
                            height: 60px;
                            background: var(--bg);
                            border: 1px solid var(--border);
                            color: var(--text);
                            border-radius: 8px;
                            padding: 8px;
                            font-size: 14px;
                            resize: vertical;
                        }
                        .form-group textarea:focus { outline: none; border-color: var(--primary); }

                        .footer {
                            padding: 16px 20px;
                            border-top: 1px solid var(--border);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        .stats { font-size: 12px; color: #8899a6; }
                        .btn-save {
                            background: var(--primary);
                            color: white;
                            border: none;
                            padding: 8px 24px;
                            border-radius: 20px;
                            font-weight: bold;
                            cursor: pointer;
                        }
                        .btn-save:hover { background: #1a8cd8; }

                        .switch-group { margin-bottom: 12px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; }
                        .switch { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 8px; }
                        .switch:last-child { margin-bottom: 0; }
                        .switch input { cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary); }
                    </style>

                    <div class="fab" id="fab">🛡️</div>

                    <div class="panel" id="panel">
                        <div class="header">
                            <div>X/Twitter 净网控制台</div>
                            <div class="close-btn" id="close-btn">✖</div>
                        </div>
                        <div class="content">
                            <div class="switch-group">
                                <div class="switch">
                                    <input type="checkbox" id="toggle-engine" ${Config.data.enabled ? 'checked' : ''}>
                                    <label for="toggle-engine" style="font-weight:bold;">启用总开关 (彻底隐形)</label>
                                </div>
                                <div class="switch">
                                    <input type="checkbox" id="toggle-zero-comment" ${Config.data.rules.hideZeroComments ? 'checked' : ''}>
                                    <label for="toggle-zero-comment" style="color:#e0245e;">屏蔽 0 评论推文 (过滤主页低质量号)</label>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>屏蔽昵称 (每行一个，模糊匹配)</label>
                                <textarea id="kw-nickname" placeholder="例如：抽奖\n发卡">${Config.data.rules.nickname.join('\n')}</textarea>
                            </div>
                            <div class="form-group">
                                <label>屏蔽主时间线推文 (每行一个)</label>
                                <textarea id="kw-tweet" placeholder="例如：#广告\n澳门">${Config.data.rules.tweet.join('\n')}</textarea>
                            </div>
                            <div class="form-group">
                                <label>屏蔽评论区/回复 (每行一个)</label>
                                <textarea id="kw-comment" placeholder="例如：互fo\n骗子">${Config.data.rules.comment.join('\n')}</textarea>
                            </div>
                        </div>
                        <div class="footer">
                            <div class="stats">已无缝清理: <span id="stat-count">${Config.data.stats.blockedCount}</span> 条</div>
                            <button class="btn-save" id="save-btn">保存并生效</button>
                        </div>
                    </div>
                `;
            },

            bindEvents() {
                const fab = this.shadow.getElementById('fab');
                const panel = this.shadow.getElementById('panel');
                const closeBtn = this.shadow.getElementById('close-btn');
                const saveBtn = this.shadow.getElementById('save-btn');

                let isDragging = false, startX, startY, initX, initY;
                fab.addEventListener('mousedown', e => {
                    isDragging = true;
                    startX = e.clientX; startY = e.clientY;
                    const rect = fab.getBoundingClientRect();
                    initX = rect.left; initY = rect.top;
                    fab.style.transition = 'none';
                });
                document.addEventListener('mousemove', e => {
                    if (!isDragging) return;
                    e.preventDefault();
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    fab.style.left = `${initX + dx}px`;
                    fab.style.top = `${initY + dy}px`;
                    fab.style.right = 'auto';
                    fab.style.bottom = 'auto';
                });
                document.addEventListener('mouseup', e => {
                    if (!isDragging) return;
                    isDragging = false;
                    fab.style.transition = 'transform 0.2s';
                    if (Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) {
                        panel.classList.add('show');
                    }
                });

                closeBtn.addEventListener('click', () => panel.classList.remove('show'));

                saveBtn.addEventListener('click', () => {
                    Config.data.enabled = this.shadow.getElementById('toggle-engine').checked;
                    Config.data.rules.hideZeroComments = this.shadow.getElementById('toggle-zero-comment').checked; // 获取新增开关状态
                    Config.data.rules.nickname = this.shadow.getElementById('kw-nickname').value.split('\n').map(s => s.trim()).filter(s => s);
                    Config.data.rules.tweet = this.shadow.getElementById('kw-tweet').value.split('\n').map(s => s.trim()).filter(s => s);
                    Config.data.rules.comment = this.shadow.getElementById('kw-comment').value.split('\n').map(s => s.trim()).filter(s => s);

                    Config.save();
                    saveBtn.innerText = '已保存 ✓';
                    saveBtn.style.background = '#00ba7c';

                    Engine.reRun();

                    setTimeout(() => {
                        saveBtn.innerText = '保存并生效';
                        saveBtn.style.background = 'var(--primary)';
                    }, 2000);
                });

                GM_registerMenuCommand('打开净网控制台', () => {
                    panel.classList.add('show');
                });
            },

            updateStats() {
                if (this.shadow) {
                    const countEl = this.shadow.getElementById('stat-count');
                    if (countEl) countEl.innerText = Config.data.stats.blockedCount;
                }
            }
        };

        // --- 4. 初始化入口 ---
        const Boot = () => {
            console.log('[X Blocker] 核心进化，无缝隐形引擎(带0评过滤)已启动');
            injectStyles();
            Config.load();
            UI.init();
            Engine.observe();
            Engine.processTweets();
        };

        return { Boot };
    })();

    window.addEventListener('load', () => {
        setTimeout(App.Boot, 1000);
    });

})();
