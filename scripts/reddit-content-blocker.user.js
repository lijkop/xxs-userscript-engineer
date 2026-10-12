// ==UserScript==
// @name         Reddit 内容屏蔽器
// @name:en      Reddit Content Blocker
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  按关键词与用户名屏蔽 Reddit 帖子、评论和用户，支持规则导入导出与可视化面板。
// @description:en Block Reddit posts, comments and users by keyword or username, with rule import/export and a control panel.
// @author       小小薯 (XXS)
// @homepage     https://github.com/XXS-pickle/xxs-userscript-engineer
// @supportURL   https://github.com/XXS-pickle/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/XXS-pickle/xxs-userscript-engineer/main/scripts/reddit-content-blocker.user.js
// @downloadURL  https://raw.githubusercontent.com/XXS-pickle/xxs-userscript-engineer/main/scripts/reddit-content-blocker.user.js
// @match        https://www.reddit.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- 数据初始化 ---
    let blockedData = GM_getValue('reddit_filter_data', {
        users: [],
        keywords: []
    });

    // --- 样式注入 ---
    GM_addStyle(`
        #rf-panel { position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: #1a1a1b; border: 1px solid #343536; padding: 15px; border-radius: 8px; color: #d7dadc; display: none; width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif; }
        #rf-toggle { position: fixed; bottom: 20px; right: 20px; z-index: 9998; padding: 8px 12px; background: #ff4500; color: white; border: none; border-radius: 20px; cursor: pointer; font-weight: bold; }
        .rf-section { margin-bottom: 15px; }
        .rf-label { display: block; margin-bottom: 5px; font-size: 12px; color: #818384; }
        .rf-input { width: 100%; background: #272729; border: 1px solid #343536; color: white; padding: 5px; box-sizing: border-box; margin-bottom: 5px; }
        .rf-btn-group { display: flex; gap: 5px; }
        .rf-btn { flex: 1; padding: 5px; cursor: pointer; border: none; border-radius: 4px; font-size: 12px; }
        .rf-save { background: #d7dadc; color: #1a1a1b; }
        .rf-export { background: #343536; color: white; }
    `);

    // --- 核心过滤逻辑 ---
    function applyFilter() {
        // 1. 过滤帖子 (Feed)
        document.querySelectorAll('shreddit-post').forEach(post => {
            const author = post.getAttribute('author');
            const title = post.querySelector('[slot="title"]')?.innerText || "";
            if (shouldBlock(author, title)) post.style.display = 'none';
        });

        // 2. 过滤评论 (Comments)
        document.querySelectorAll('shreddit-comment').forEach(comment => {
            const author = comment.getAttribute('author');
            const content = comment.querySelector('div[slot="comment"]')?.innerText || "";
            if (shouldBlock(author, content)) comment.style.display = 'none';
        });
    }

    function shouldBlock(author, text) {
        if (blockedData.users.includes(author)) return true;
        return blockedData.keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
    }

    // --- UI 面板构建 ---
    const panel = document.createElement('div');
    panel.id = 'rf-panel';
    panel.innerHTML = `
        <div class="rf-section">
            <span class="rf-label">屏蔽用户 (逗号隔开)</span>
            <textarea id="rf-users" class="rf-input" rows="3">${blockedData.users.join(', ')}</textarea>
        </div>
        <div class="rf-section">
            <span class="rf-label">屏蔽关键词 (逗号隔开)</span>
            <textarea id="rf-keywords" class="rf-input" rows="3">${blockedData.keywords.join(', ')}</textarea>
        </div>
        <div class="rf-btn-group">
            <button id="rf-save-btn" class="rf-btn rf-save">保存并刷新</button>
            <button id="rf-export-btn" class="rf-btn rf-export">导入/导出</button>
        </div>
    `;
    document.body.appendChild(panel);

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'rf-toggle';
    toggleBtn.innerText = 'R-Filter';
    document.body.appendChild(toggleBtn);

    // --- 事件绑定 ---
    toggleBtn.onclick = () => panel.style.display = panel.style.display === 'none' ? 'block' : 'none';

    document.getElementById('rf-save-btn').onclick = () => {
        const users = document.getElementById('rf-users').value.split(',').map(s => s.trim()).filter(s => s);
        const keywords = document.getElementById('rf-keywords').value.split(',').map(s => s.trim()).filter(s => s);
        blockedData = { users, keywords };
        GM_setValue('reddit_filter_data', blockedData);
        location.reload();
    };

    document.getElementById('rf-export-btn').onclick = () => {
        const action = prompt("输入 'E' 导出配置到剪贴板，输入 JSON 字符串进行导入:");
        if (action?.toUpperCase() === 'E') {
            navigator.clipboard.writeText(JSON.stringify(blockedData));
            alert("已复制到剪贴板");
        } else if (action) {
            try {
                const newData = JSON.parse(action);
                if (newData.users && newData.keywords) {
                    GM_setValue('reddit_filter_data', newData);
                    location.reload();
                }
            } catch (e) { alert("格式错误"); }
        }
    };

    // --- 监听动态加载 ---
    const observer = new MutationObserver(() => applyFilter());
    observer.observe(document.body, { childList: true, subtree: true });
    applyFilter();

})();
