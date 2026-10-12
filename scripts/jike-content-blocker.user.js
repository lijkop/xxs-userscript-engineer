// ==UserScript==
// @name         即刻内容屏蔽器
// @name:en      Jike Content Blocker
// @namespace    http://tampermonkey.net/
// @version      3.2.0
// @description  按关键词屏蔽即刻时间线内容，支持已读隐藏与去重处理。
// @description:en Block Jike timeline posts by keyword, with read-hiding and deduplication.
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/jike-content-blocker.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/jike-content-blocker.user.js
// @match        https://web.okjike.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    const DEFAULT_CONFIG = {
        keywords: ['吃播'],
        communities: ['喵星人的日常'],
        users: [],
        hideSeen: true,
        enabled: true
    };

    const HISTORY_LIMIT = 1500;
    // 关键：记录页面启动时的已读列表，本次会话新看到的帖子不在此列，避免被立即隐藏
    const INITIAL_SEEN_IDS = new Set(GM_getValue('jike_seen_ids', []));

    function getConfig() {
        const saved = GM_getValue('jike_blocker_config_v3');
        return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    }

    function saveConfig(config) {
        GM_setValue('jike_blocker_config_v3', JSON.stringify(config));
    }

    // 提取更稳定的帖子 ID
    function getPostId(el) {
        // 方案 A: 尝试获取帖子链接里的唯一 ID
        const link = el.querySelector('a[href*="/post/"], a[href*="/repost/"]');
        if (link) {
            return link.getAttribute('href').split('/').pop().split('?')[0];
        }
        // 方案 B: 根据内容哈希（备用）
        const contentEl = el.querySelector('[class*="_content_"]');
        if (contentEl) {
            const text = contentEl.textContent.trim();
            if (text.length > 0) {
                let hash = 0;
                for (let i = 0; i < text.length; i++) {
                    hash = ((hash << 5) - hash) + text.charCodeAt(i);
                    hash |= 0;
                }
                return 'hash_' + hash;
            }
        }
        return null;
    }

    function shouldBlock(postElement, config) {
        if (!config.enabled) return null;

        // 1. 用户名屏蔽 (支持模糊选择器)
        const usernameEl = postElement.querySelector('[class*="_username_"]');
        if (usernameEl) {
            const username = usernameEl.textContent.trim();
            if (config.users.includes(username)) return { type: '用户', value: username };
        }

        // 2. 社区名屏蔽
        const communityLink = postElement.querySelector('a[href*="/topic/"]');
        if (communityLink) {
            const communityText = communityLink.textContent.trim();
            if (config.communities.includes(communityText)) return { type: '社区', value: communityText };
        }

        // 3. 关键字屏蔽
        const contentEl = postElement.querySelector('[class*="_content_"]');
        if (contentEl) {
            const text = contentEl.textContent.toLowerCase();
            const matchedKeyword = config.keywords.find(kw => text.includes(kw.toLowerCase()));
            if (matchedKeyword) return { type: '关键字', value: matchedKeyword };
        }

        return null;
    }

    function hidePost(el, reason) {
        el.style.display = 'none';
        el.setAttribute('data-jike-blocked', '1');
        if (reason.type !== '已读') {
            console.log(`[即刻屏蔽器] 拦截: ${reason.type} -> ${reason.value}`);
        }
    }

    function processAllPosts() {
        const config = getConfig();
        const posts = document.querySelectorAll('[data-clickable-feedback="true"]');
        let currentSeenIds = GM_getValue('jike_seen_ids', []);
        let needsSave = false;

        posts.forEach(post => {
            if (post.hasAttribute('data-jike-blocked')) return;

            // 获取 ID
            const pid = getPostId(post);

            // A. 基础规则屏蔽（用户、关键字等）
            const blockReason = shouldBlock(post, config);
            if (blockReason) {
                hidePost(post, blockReason);
                return;
            }

            // B. 已读去重逻辑
            if (config.hideSeen && pid) {
                // 只有当 ID 存在于“本次打开网页之前”的历史记录中，才屏蔽
                if (INITIAL_SEEN_IDS.has(pid)) {
                    hidePost(post, { type: '已读' });
                    return;
                } else {
                    // 如果是本次新看到的，加入缓存准备存入历史，但不隐藏
                    if (!currentSeenIds.includes(pid)) {
                        currentSeenIds.push(pid);
                        needsSave = true;
                    }
                }
            }
        });

        if (needsSave) {
            if (currentSeenIds.length > HISTORY_LIMIT) {
                currentSeenIds = currentSeenIds.slice(-HISTORY_LIMIT);
            }
            GM_setValue('jike_seen_ids', currentSeenIds);
        }
    }

    // 针对 React 列表的优化观察器
    function startObserver() {
        const observer = new MutationObserver(processAllPosts);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function createSettingsPanel() {
        const config = getConfig();
        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
        panel.innerHTML = `
            <div style="background:white;padding:25px;border-radius:12px;width:400px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.3);font-family:sans-serif;">
                <h3 style="margin:0 0 15px;">即刻屏蔽器设置</h3>
                <div style="margin-bottom:15px;">
                    <label><input type="checkbox" id="j-en" ${config.enabled ? 'checked' : ''}> 启用屏蔽</label>
                    <label style="margin-left:20px;"><input type="checkbox" id="j-seen" ${config.hideSeen ? 'checked' : ''}> 屏蔽历史已读</label>
                </div>
                <p style="font-size:12px;color:#666;margin-bottom:10px;">* 已读屏蔽只针对“上一次访问”的内容，本次刷出的不会消失。</p>
                <h4 style="margin:10px 0 5px;">关键字/用户/社区 (每行一个)</h4>
                <textarea id="j-kw" placeholder="关键字" style="width:100%;height:60px;margin-bottom:10px;">${config.keywords.join('\n')}</textarea>
                <textarea id="j-town" placeholder="社区名" style="width:100%;height:60px;margin-bottom:10px;">${config.communities.join('\n')}</textarea>
                <textarea id="j-user" placeholder="用户名" style="width:100%;height:60px;">${config.users.join('\n')}</textarea>
                <div style="margin-top:20px;text-align:right;">
                    <button id="j-clear" style="float:left;padding:8px;color:red;background:none;border:none;cursor:pointer;">清空历史记录</button>
                    <button id="j-cancel" style="padding:8px 15px;background:#eee;border:none;border-radius:4px;cursor:pointer;">取消</button>
                    <button id="j-ok" style="padding:8px 15px;background:#03A9F4;color:white;border:none;border-radius:4px;cursor:pointer;margin-left:10px;">保存并刷新</button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('#j-clear').onclick = () => { if(confirm('重置已读列表？')) GM_setValue('jike_seen_ids', []); };
        panel.querySelector('#j-cancel').onclick = () => panel.remove();
        panel.querySelector('#j-ok').onclick = () => {
            saveConfig({
                enabled: panel.querySelector('#j-en').checked,
                hideSeen: panel.querySelector('#j-seen').checked,
                keywords: panel.querySelector('#j-kw').value.split('\n').filter(Boolean),
                communities: panel.querySelector('#j-town').value.split('\n').filter(Boolean),
                users: panel.querySelector('#j-user').value.split('\n').filter(Boolean)
            });
            location.reload();
        };
    }

    function init() {
        startObserver();
        const btn = document.createElement('div');
        btn.innerHTML = '⚙️';
        btn.style.cssText = 'position:fixed;bottom:80px;right:20px;width:40px;height:40px;background:#03A9F4;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:999;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
        btn.onclick = createSettingsPanel;
        document.body.appendChild(btn);
        processAllPosts();
    }

    GM_registerMenuCommand('屏蔽设置', createSettingsPanel);
    init();
})();
