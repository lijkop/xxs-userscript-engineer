// ==UserScript==
// @name         小红书关键词屏蔽器
// @name:en      Xiaohongshu Keyword Blocker
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  小红书网页版关键词屏蔽工具，支持可视化面板、无限滚动适配、隐藏与模糊两种拦截模式、规则本地持久化。
// @description:en Keyword blocker for Xiaohongshu web: control panel, infinite-scroll support, hide/blur modes, persistent local rules.
// @author       小小薯 (XXS)
// @homepage     https://github.com/xxs-scripts/userscripts
// @supportURL   https://github.com/xxs-scripts/userscripts/issues
// @match        *://*.xiaohongshu.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. 配置中心 (持久化驱动)
    // ==========================================
    const Config = {
        data: {
            keywords: ['广告', '引流', '私信', 'V我'], // 默认关键词
            mode: 'hide', // 'hide' 完全隐藏, 'blur' 模糊处理
            blockCount: 0 // 累计拦截数
        },
        load() {
            const saved = GM_getValue('xhs_blocker_config');
            if (saved) {
                this.data = Object.assign(this.data, saved);
            } else {
                this.save();
            }
        },
        save() {
            GM_setValue('xhs_blocker_config', this.data);
        },
        addKeyword(word) {
            word = word.trim();
            if (word && !this.data.keywords.includes(word)) {
                this.data.keywords.push(word);
                this.save();
                return true;
            }
            return false;
        },
        removeKeyword(word) {
            this.data.keywords = this.data.keywords.filter(k => k !== word);
            this.save();
        },
        incrementCount() {
            this.data.blockCount++;
            this.save();
            UI.updateStats();
        }
    };

    // ==========================================
    // 2. 核心引擎 (DOM拦截与业务逻辑)
    // ==========================================
    const Engine = {
        timer: null,
        selectors: {
            noteCard: 'section.note-item, div.note-item' // 适配小红书瀑布流笔记容器
        },

        // 执行扫描过滤
        scan() {
            const cards = document.querySelectorAll(`${this.selectors.noteCard}:not([data-xb-processed="true"])`);
            if (cards.length === 0) return;

            cards.forEach(card => {
                card.setAttribute('data-xb-processed', 'true');
                const text = card.innerText || '';

                const matchedKeyword = Config.data.keywords.find(kw => text.includes(kw));

                if (matchedKeyword) {
                    this.applyBlock(card, matchedKeyword);
                    Config.incrementCount();
                }
            });
        },

        // 应用屏蔽样式
        applyBlock(el, keyword) {
            if (Config.data.mode === 'hide') {
                el.style.display = 'none';
            } else {
                // 模糊模式
                el.style.filter = 'blur(10px)';
                el.style.opacity = '0.5';
                el.style.transition = 'all 0.3s';
                el.title = `已被拦截，命中关键词: [${keyword}] (双击解除屏蔽)`;

                // 双击临时查看
                el.addEventListener('dblclick', function() {
                    this.style.filter = 'none';
                    this.style.opacity = '1';
                });
            }
        },

        // 动态监控页面变化 (适配下拉无限滚动)
        observe() {
            const observer = new MutationObserver((mutations) => {
                let shouldScan = false;
                for (let m of mutations) {
                    if (m.addedNodes.length > 0) {
                        shouldScan = true;
                        break;
                    }
                }

                // 防抖处理，避免滚动卡顿
                if (shouldScan) {
                    clearTimeout(this.timer);
                    this.timer = setTimeout(() => this.scan(), 200);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 首次执行
            this.scan();
        },

        // 当配置改变时，重置所有状态并重新扫描
        forceRescan() {
            const cards = document.querySelectorAll('[data-xb-processed="true"]');
            cards.forEach(card => {
                card.removeAttribute('data-xb-processed');
                card.style.display = '';
                card.style.filter = '';
                card.style.opacity = '';
            });
            this.scan();
        }
    };

    // ==========================================
    // 3. UI控制器 (可视化面板 & 悬浮球)
    // ==========================================
    const UI = {
        init() {
            this.injectStyles();
            this.createFloatBtn();
            this.createPanel();
            this.bindEvents();
            this.updateKeywordsList();
            this.updateStats();

            // 注册菜单命令作为备用唤醒方式
            GM_registerMenuCommand('⚙️ 打开屏蔽设置', () => this.togglePanel());
        },

        injectStyles() {
            const css = `
                /* 悬浮球 */
                #xb-float-btn {
                    position: fixed; bottom: 50px; left: 20px; z-index: 999999;
                    width: 44px; height: 44px; background: #ff2442; color: #fff;
                    border-radius: 50%; box-shadow: 0 4px 12px rgba(255, 36, 66, 0.4);
                    display: flex; justify-content: center; align-items: center;
                    cursor: pointer; user-select: none; transition: transform 0.2s;
                    font-size: 20px; font-weight: bold; font-family: sans-serif;
                }
                #xb-float-btn:hover { transform: scale(1.1); }
                #xb-float-btn:active { transform: scale(0.9); }

                /* 主面板 */
                #xb-panel {
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    width: 320px; background: #fff; border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 999999;
                    display: none; flex-direction: column; overflow: hidden;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    border: 1px solid #ebebeb;
                }
                #xb-panel.xb-show { display: flex; animation: xb-pop 0.3s ease-out; }
                @keyframes xb-pop { 0% { opacity: 0; transform: translate(-50%, -45%); } 100% { opacity: 1; transform: translate(-50%, -50%); } }

                /* 面板头部 */
                .xb-header { background: #ff2442; color: #fff; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
                .xb-title { font-size: 16px; font-weight: 600; }
                .xb-close { cursor: pointer; font-size: 18px; line-height: 1; opacity: 0.8; }
                .xb-close:hover { opacity: 1; }

                /* 面板内容 */
                .xb-body { padding: 16px; }

                /* 统计区 */
                .xb-stats { background: #f8f8f8; border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 15px; color: #555; font-size: 13px; }
                .xb-stats span { color: #ff2442; font-weight: bold; font-size: 16px; margin: 0 4px; }

                /* 模式切换 */
                .xb-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; font-size: 14px; color: #333; }
                .xb-select { padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; outline: none; }

                /* 输入区 */
                .xb-input-group { display: flex; gap: 8px; margin-bottom: 15px; }
                .xb-input { flex: 1; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; outline: none; font-size: 13px; }
                .xb-input:focus { border-color: #ff2442; }
                .xb-btn { background: #ff2442; color: #fff; border: none; padding: 0 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
                .xb-btn:hover { background: #e01f39; }

                /* 标签云 */
                .xb-tags { display: flex; flex-wrap: wrap; gap: 8px; max-height: 150px; overflow-y: auto; padding-right: 5px; }
                .xb-tag { background: #fff1f2; color: #ff2442; border: 1px solid #ffccdc; padding: 4px 8px; border-radius: 12px; font-size: 12px; display: flex; align-items: center; gap: 4px; }
                .xb-tag-del { cursor: pointer; font-weight: bold; width: 14px; height: 14px; display: flex; justify-content: center; align-items: center; border-radius: 50%; }
                .xb-tag-del:hover { background: #ff2442; color: #fff; }

                /* 滚动条美化 */
                .xb-tags::-webkit-scrollbar { width: 4px; }
                .xb-tags::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }
            `;
            GM_addStyle(css);
        },

        createFloatBtn() {
            const btn = document.createElement('div');
            btn.id = 'xb-float-btn';
            btn.innerHTML = '🛡️';
            btn.title = '小红书关键词屏蔽设置';
            document.body.appendChild(btn);

            // 拖拽逻辑
            let isDragging = false, startX, startY, initialX, initialY;
            btn.addEventListener('mousedown', e => {
                isDragging = false; startX = e.clientX; startY = e.clientY;
                initialX = btn.offsetLeft; initialY = btn.offsetTop;
                const onMouseMove = e => {
                    if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) isDragging = true;
                    if (!isDragging) return;
                    btn.style.left = `${initialX + e.clientX - startX}px`;
                    btn.style.top = `${initialY + e.clientY - startY}px`;
                    btn.style.bottom = 'auto'; // 覆盖初始bottom
                };
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            btn.addEventListener('click', () => { if (!isDragging) this.togglePanel(); });
        },

        createPanel() {
            const panel = document.createElement('div');
            panel.id = 'xb-panel';
            panel.innerHTML = `
                <div class="xb-header">
                    <span class="xb-title">🛡️ XHS 屏蔽引擎面板</span>
                    <span class="xb-close" id="xb-close-btn">&times;</span>
                </div>
                <div class="xb-body">
                    <div class="xb-stats">全网累计为您拦截笔记 <span id="xb-count">0</span> 篇</div>
                    <div class="xb-row">
                        <label>屏蔽模式：</label>
                        <select class="xb-select" id="xb-mode-select">
                            <option value="hide" ${Config.data.mode === 'hide' ? 'selected' : ''}>彻底隐藏 (眼不见为净)</option>
                            <option value="blur" ${Config.data.mode === 'blur' ? 'selected' : ''}>高斯模糊 (双击可查看)</option>
                        </select>
                    </div>
                    <div class="xb-input-group">
                        <input type="text" class="xb-input" id="xb-kw-input" placeholder="输入要屏蔽的词(如: 推广)">
                        <button class="xb-btn" id="xb-add-btn">添加</button>
                    </div>
                    <div class="xb-tags" id="xb-tags-container"></div>
                </div>
            `;
            document.body.appendChild(panel);
        },

        bindEvents() {
            document.getElementById('xb-close-btn').addEventListener('click', () => this.togglePanel(false));

            // 添加关键词
            const addAction = () => {
                const input = document.getElementById('xb-kw-input');
                if (Config.addKeyword(input.value)) {
                    input.value = '';
                    this.updateKeywordsList();
                    Engine.forceRescan(); // 添加新词后立即重新扫描页面
                }
            };
            document.getElementById('xb-add-btn').addEventListener('click', addAction);
            document.getElementById('xb-kw-input').addEventListener('keypress', e => { if(e.key === 'Enter') addAction(); });

            // 模式切换
            document.getElementById('xb-mode-select').addEventListener('change', e => {
                Config.data.mode = e.target.value;
                Config.save();
                Engine.forceRescan();
            });

            // 委托删除标签事件
            document.getElementById('xb-tags-container').addEventListener('click', e => {
                if (e.target.classList.contains('xb-tag-del')) {
                    const word = e.target.parentElement.getAttribute('data-word');
                    Config.removeKeyword(word);
                    this.updateKeywordsList();
                    Engine.forceRescan();
                }
            });
        },

        togglePanel(force) {
            const panel = document.getElementById('xb-panel');
            if (force === undefined) {
                panel.classList.toggle('xb-show');
            } else {
                force ? panel.classList.add('xb-show') : panel.classList.remove('xb-show');
            }
        },

        updateKeywordsList() {
            const container = document.getElementById('xb-tags-container');
            container.innerHTML = Config.data.keywords.map(kw =>
                `<div class="xb-tag" data-word="${kw}">${kw} <span class="xb-tag-del">&times;</span></div>`
            ).join('');
        },

        updateStats() {
            const countEl = document.getElementById('xb-count');
            if (countEl) countEl.innerText = Config.data.blockCount;
        }
    };

    // ==========================================
    // 4. 初始化入口
    // ==========================================
    const Boot = () => {
        // 确保在主页面运行
        if (window.top !== window.self) return;

        Config.load();
        UI.init();
        Engine.observe();
    };

    // 启动系统
    Boot();

})();
