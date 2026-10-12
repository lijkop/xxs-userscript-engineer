// ==UserScript==
// @name         小红书评论批量复制
// @name:en      Xiaohongshu Comment Copier
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  悬浮球触发，一键提取小红书笔记评论并复制到剪贴板，支持自动滚动加载。
// @description:en A floating ball that extracts Xiaohongshu note comments to the clipboard, with auto-scroll loading.
// @author       小小薯 (XXS)
// @homepage     https://github.com/xxs-scripts/userscripts
// @supportURL   https://github.com/xxs-scripts/userscripts/issues
// @match        https://www.xiaohongshu.com/explore/*
// @match        https://www.xiaohongshu.com/search_result/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_notification
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const XHS_TOOL = (() => {
        // --- 1. 数据中心 ---
        const State = {
            isOpen: false,
            isCapturing: false,
            autoScroll: false,
            data: new Map(),
            scrollTimer: null
        };

        const Selectors = {
            item: '.comment-item',
            nickname: '.nickname',
            content: '.note-text',
            date: '.date'
        };

        // --- 2. 核心引擎 ---
        const Engine = {
            parse() {
                const nodes = document.querySelectorAll(Selectors.item);
                nodes.forEach(node => {
                    const id = node.id || node.getAttribute('data-v-0b48985c');
                    if (!id || State.data.has(id)) return;

                    const user = node.querySelector(Selectors.nickname)?.innerText?.trim() || '未知用户';
                    const text = node.querySelector(Selectors.content)?.innerText?.trim() || '';
                    const time = node.querySelector(Selectors.date)?.innerText?.split(/\s+/)[0] || '';

                    if(text) State.data.set(id, { user, text, time });
                });
                UI.updateBadge();
            },

            copy() {
                if (State.data.size === 0) {
                    alert('还没有抓取到数据哦！');
                    return;
                }
                // 格式化：昵称 \t 内容 \t 时间 (Tab分隔，Excel完美支持)
                let output = "用户昵称\t评论内容\t发布日期\n";
                State.data.forEach(item => {
                    output += `${item.user}\t${item.text}\t${item.time}\n`;
                });

                GM_setClipboard(output);
                GM_notification({
                    text: `已成功复制 ${State.data.size} 条评论到剪贴板`,
                    title: "提取成功",
                    timeout: 2000
                });
            },

            toggleScroll(active) {
                State.autoScroll = active;
                if (active) {
                    State.scrollTimer = setInterval(() => {
                        window.scrollBy(0, 600);
                        this.parse();
                    }, 1200);
                } else {
                    clearInterval(State.scrollTimer);
                }
            }
        };

        // --- 3. UI 界面层 (Shadow DOM 隔离) ---
        const UI = {
            container: null,
            root: null,

            init() {
                this.container = document.createElement('div');
                this.root = this.container.attachShadow({mode: 'open'});
                this.injectStyle();
                this.render();
                document.body.appendChild(this.container);

                // 自动监听 DOM
                const observer = new MutationObserver(() => {
                    if (State.isCapturing) Engine.parse();
                });
                observer.observe(document.body, { childList: true, subtree: true });
            },

            injectStyle() {
                const css = `
                    :host { --primary: #ff2442; }
                    #ball {
                        position: fixed; bottom: 100px; right: 20px; width: 50px; height: 50px;
                        background: var(--primary); border-radius: 50%; color: white;
                        display: flex; align-items: center; justify-content: center;
                        cursor: pointer; box-shadow: 0 4px 12px rgba(255,36,66,0.4);
                        z-index: 10000; transition: transform 0.3s; font-size: 12px; font-weight: bold;
                    }
                    #ball:hover { transform: scale(1.1); }
                    #badge {
                        position: absolute; top: -5px; right: -5px; background: #333;
                        padding: 2px 6px; border-radius: 10px; font-size: 10px;
                    }
                    #panel {
                        position: fixed; bottom: 140px; right: 20px; width: 200px;
                        background: white; border-radius: 12px; padding: 15px;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                        display: none; flex-direction: column; gap: 10px;
                        z-index: 9999; border: 1px solid #eee; font-family: system-ui;
                    }
                    .show { display: flex !important; animation: slideIn 0.3s ease; }
                    .btn {
                        padding: 8px; border: none; border-radius: 6px; cursor: pointer;
                        font-size: 13px; transition: 0.2s;
                    }
                    .btn-copy { background: var(--primary); color: white; }
                    .btn-scroll { background: #f0f0f0; color: #333; }
                    .btn-clear { background: transparent; color: #999; font-size: 11px; }
                    label { font-size: 12px; display: flex; align-items: center; gap: 5px; cursor: pointer; }
                    @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                `;
                const style = document.createElement('style');
                style.textContent = css;
                this.root.appendChild(style);
            },

            render() {
                const html = `
                    <div id="ball">
                        抓取
                        <span id="badge">0</span>
                    </div>
                    <div id="panel">
                        <label>
                            <input type="checkbox" id="check-scroll"> 自动向下滚动采集
                        </label>
                        <button class="btn btn-copy" id="btn-copy">复制采集结果</button>
                        <button class="btn btn-scroll" id="btn-toggle">开启实时监测</button>
                        <button class="btn btn-clear" id="btn-clear">清空当前记录</button>
                    </div>
                `;
                const div = document.createElement('div');
                div.innerHTML = html;
                this.root.appendChild(div);

                // 绑定事件
                const $ = (id) => this.root.getElementById(id);

                $('ball').onclick = () => {
                    State.isOpen = !State.isOpen;
                    $('panel').classList.toggle('show', State.isOpen);
                };

                $('btn-toggle').onclick = (e) => {
                    State.isCapturing = !State.isCapturing;
                    e.target.innerText = State.isCapturing ? "停止监测" : "开启实时监测";
                    e.target.style.background = State.isCapturing ? "#e5e5e5" : "#f0f0f0";
                    if(State.isCapturing) Engine.parse();
                };

                $('check-scroll').onchange = (e) => Engine.toggleScroll(e.target.checked);

                $('btn-copy').onclick = () => Engine.copy();

                $('btn-clear').onclick = () => {
                    State.data.clear();
                    this.updateBadge();
                };
            },

            updateBadge() {
                const b = this.root.getElementById('badge');
                if (b) b.innerText = State.data.size;
            }
        };

        return { init: () => UI.init() };
    })();

    XHS_TOOL.init();
})();
