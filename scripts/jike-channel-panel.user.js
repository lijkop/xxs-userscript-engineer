// ==UserScript==
// @name         即刻分区快捷面板
// @name:en      Jike Channel Quick Panel
// @namespace    http://tampermonkey.net/
// @version      0.3.0
// @description  在即刻网页版右下角添加常驻悬浮面板，用于收藏和快速跳转自定义分区。
// @description:en Adds a persistent floating panel on Jike web to bookmark and jump to custom channels.
// @author       小小薯 (XXS)
// @homepage     https://github.com/XXS-pickle/userscripts
// @supportURL   https://github.com/XXS-pickle/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/jike-channel-panel.user.js
// @downloadURL  https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/jike-channel-panel.user.js
// @match        https://web.okjike.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 默认自带的两个圈子示例
    const defaultLinks = [
        { title: 'AI 探索站', url: 'https://web.okjike.com/topic/63579abb6724cc583b9bba9a/square' },
        { title: '工程师日常', url: 'https://web.okjike.com/topic/577c5a122fa95b1100da059f/square' }
    ];

    // 从本地存储读取已保存的链接，如果没有则使用默认链接
    let savedLinks = GM_getValue('jike_custom_links', defaultLinks);

    // 注入面板的 CSS 样式
    GM_addStyle(`
        #jike-custom-panel-container {
            position: fixed;
            bottom: 40px;
            right: 40px;
            z-index: 999999;
            font-family: system-ui, -apple-system, sans-serif;
        }
        #jike-custom-toggle-btn {
            width: 50px;
            height: 50px;
            background-color: #ffe100;
            color: #333;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 24px;
            user-select: none;
            transition: transform 0.2s, box-shadow 0.2s;
            position: absolute;
            bottom: 0;
            right: 0;
        }
        #jike-custom-toggle-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }
        #jike-custom-panel {
            position: absolute;
            bottom: 65px; /* 留出悬浮球的空间 */
            right: 0;
            width: 280px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            padding: 16px;
            /* 👇 关键修改 1：将 display 默认设置为 flex，让面板默认保持打开 */
            display: flex;
            flex-direction: column;
            gap: 12px;
            border: 1px solid #eee;
        }
        /* 暗色模式适配 */
        html[data-mantine-color-scheme="dark"] #jike-custom-panel {
            background: #1A1B1E;
            border-color: #373A40;
            color: #C1C2C5;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .jike-panel-header {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 4px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
            color: inherit;
        }
        html[data-mantine-color-scheme="dark"] .jike-panel-header {
            border-bottom-color: #373A40;
        }
        .jike-link-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 300px;
            overflow-y: auto;
        }
        .jike-link-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f8f9fa;
            border-radius: 6px;
            text-decoration: none;
            color: #333;
            transition: background 0.2s;
        }
        html[data-mantine-color-scheme="dark"] .jike-link-item {
            background: #2C2E33;
            color: #C1C2C5;
        }
        .jike-link-item:hover {
            background: #f1f3f5;
        }
        html[data-mantine-color-scheme="dark"] .jike-link-item:hover {
            background: #373A40;
        }
        .jike-link-item-text {
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 190px;
            color: inherit;
            text-decoration: none;
        }
        .jike-link-delete {
            color: #ff6b6b;
            cursor: pointer;
            font-size: 18px;
            padding: 0 4px;
            line-height: 1;
            border-radius: 4px;
        }
        .jike-link-delete:hover {
            background: rgba(255, 107, 107, 0.1);
        }
        .jike-add-form {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 8px;
            padding-top: 12px;
            border-top: 1px solid #eee;
        }
        html[data-mantine-color-scheme="dark"] .jike-add-form {
            border-top-color: #373A40;
        }
        .jike-input {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            outline: none;
            background: transparent;
            color: inherit;
        }
        html[data-mantine-color-scheme="dark"] .jike-input {
            border-color: #4C505C;
        }
        .jike-input:focus {
            border-color: #ffe100;
        }
        .jike-btn-add {
            background: #ffe100;
            color: #333;
            border: none;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            margin-top: 4px;
            transition: opacity 0.2s;
        }
        .jike-btn-add:hover {
            opacity: 0.9;
        }
    `);

    // 创建 UI
    function createUI() {
        if (document.getElementById('jike-custom-panel-container')) return;

        const container = document.createElement('div');
        container.id = 'jike-custom-panel-container';

        // 浮动球
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'jike-custom-toggle-btn';
        toggleBtn.innerHTML = '🧭';
        toggleBtn.title = '收起/展开导航';

        // 主面板
        const panel = document.createElement('div');
        panel.id = 'jike-custom-panel';

        // 核心渲染函数
        const renderPanel = () => {
            panel.innerHTML = `
                <div class="jike-panel-header">我的快捷分区</div>
                <div class="jike-link-list">
                    ${savedLinks.map((link, index) => `
                        <div class="jike-link-item">
                            <a href="${link.url}" class="jike-link-item-text" title="${link.title}">${link.title}</a>
                            <span class="jike-link-delete" data-index="${index}" title="删除此分区">×</span>
                        </div>
                    `).join('')}
                </div>
                <div class="jike-add-form">
                    <input type="text" id="jike-input-title" class="jike-input" placeholder="分区名称 (例如: AI探索站)">
                    <input type="text" id="jike-input-url" class="jike-input" placeholder="链接 (https://web.okjike...)">
                    <button id="jike-btn-add" class="jike-btn-add">添加新分区</button>
                </div>
            `;

            // 绑定删除按钮事件
            panel.querySelectorAll('.jike-link-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.target.getAttribute('data-index');
                    if (confirm(`确定要移除"${savedLinks[idx].title}"吗？`)) {
                        savedLinks.splice(idx, 1);
                        GM_setValue('jike_custom_links', savedLinks);
                        renderPanel();
                    }
                });
            });

            // 绑定添加按钮事件
            panel.querySelector('#jike-btn-add').addEventListener('click', () => {
                const title = panel.querySelector('#jike-input-title').value.trim();
                let url = panel.querySelector('#jike-input-url').value.trim();

                if (title && url) {
                    if (!url.startsWith('http')) {
                        url = 'https://' + url;
                    }
                    savedLinks.push({ title, url });
                    GM_setValue('jike_custom_links', savedLinks);
                    renderPanel();
                } else {
                    alert('请完整填写分区名称和链接哦！');
                }
            });
        };

        // 执行初始渲染
        renderPanel();

        // 点击悬浮球依然可以手动切换显示/隐藏
        toggleBtn.addEventListener('click', () => {
            panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'flex' : 'none';
        });

        // 👇 关键修改 2：彻底删除了“点击外部关闭面板”的事件监听代码

        // 组装并挂载到页面上
        container.appendChild(panel);
        container.appendChild(toggleBtn);
        document.body.appendChild(container);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }

    const observer = new MutationObserver(() => {
        if (!document.getElementById('jike-custom-panel-container')) {
            createUI();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
