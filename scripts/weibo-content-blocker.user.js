// ==UserScript==
// @name         微博内容屏蔽器
// @name:en      Weibo Content Blocker
// @namespace    https://github.com/yourname/weibo-blocker
// @version      3.4.1
// @description  按关键词屏蔽微博内容，支持悬浮窗管理、批量导入、屏蔽全部超话与蓝 V，隐藏后不占位。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:zh-CN 按关键词屏蔽微博内容，支持悬浮窗管理、批量导入、屏蔽全部超话与蓝 V，隐藏后不占位。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:en Block Weibo posts by keyword with a floating manager, bulk import, super-topic and verified-account filters; leaves no empty gaps. Feedback via Telegram: https://t.me/zzyyffxx
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/weibo-content-blocker.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/weibo-content-blocker.user.js
// @match        https://weibo.com/*
// @match        https://*.weibo.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

/* eslint-env browser, es2021 */
/* global GM_getValue, GM_setValue, GM_registerMenuCommand */

(function() {
    'use strict';

    // ==================== 存储 ====================
    let keywords = GM_getValue('wb_keywords', []);
    let blockedUsers = GM_getValue('wb_blocked_users', []);
    let sources = GM_getValue('wb_sources', []);
    let topics = GM_getValue('wb_topics', []);
    let blockAllSuperTopic = GM_getValue('wb_block_all_super_topic', false);
    let blockAllBlueV = GM_getValue('wb_block_all_blue_v', false);

    // ==================== 样式 ====================
    const style = document.createElement('style');
    style.textContent = `
        /* 【关键修复】绝对不能使用 display: none，必须使用 1px 高度强制触发框架重算 */
        .vue-recycle-scroller__item-view.wb-hidden,
        .wbpro-scroller-item.wb-hidden,
        article.wb-hidden {
            display: block !important; /* 强制覆盖 display:none */
            height: 1px !important;
            min-height: 1px !important;
            max-height: 1px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }

        /* 将内部所有元素隐形，防止内容撑开或引发渲染 */
        .vue-recycle-scroller__item-view.wb-hidden *,
        .wbpro-scroller-item.wb-hidden *,
        article.wb-hidden * {
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        /* ---------- 以下为悬浮窗原有样式保持不变 ---------- */
        .wb-float-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            background: #1e1e2f;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            border: 1px solid #3a3a4a;
        }
        .wb-float-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            background: #2a2a3a;
            border-radius: 12px 12px 0 0;
            cursor: move;
            color: #eee;
        }
        .wb-float-header button {
            background: none;
            border: none;
            color: #aaa;
            cursor: pointer;
            font-size: 16px;
            padding: 0 4px;
        }
        .wb-float-header button:hover { color: #fff; }
        .wb-float-content {
            padding: 12px;
            max-height: 450px;
            overflow-y: auto;
        }
        .wb-section {
            margin-bottom: 16px;
            border-bottom: 1px solid #3a3a4a;
            padding-bottom: 12px;
        }
        .wb-section-title {
            color: #ff9f4a;
            font-size: 12px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .wb-batch-btn {
            background: none;
            border: 1px solid #ff9f4a;
            color: #ff9f4a;
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 10px;
            cursor: pointer;
        }
        .wb-batch-btn:hover { background: #ff9f4a20; }
        .wb-input-group {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }
        .wb-input-group input {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid #3a3a4a;
            background: #2a2a3a;
            color: #eee;
            border-radius: 6px;
            font-size: 12px;
        }
        .wb-input-group button {
            padding: 6px 12px;
            background: #ff6b35;
            border: none;
            color: white;
            border-radius: 6px;
            cursor: pointer;
        }
        .wb-input-group button:hover { background: #ff8c5a; }
        .wb-list {
            max-height: 100px;
            overflow-y: auto;
        }
        .wb-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 8px;
            background: #2a2a3a;
            margin: 4px 0;
            border-radius: 6px;
            color: #ccc;
            font-size: 12px;
        }
        .wb-item button {
            background: none;
            border: none;
            color: #ff6b6b;
            cursor: pointer;
        }
        .wb-empty {
            color: #666;
            font-size: 11px;
            text-align: center;
            padding: 8px;
        }
        .wb-footer {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        .wb-footer button {
            flex: 1;
            padding: 6px;
            background: #3a3a4a;
            border: none;
            color: #ccc;
            border-radius: 6px;
            cursor: pointer;
        }
        .wb-footer button:hover { background: #4a4a5a; }
        .wb-switch-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #3a3a4a;
            margin-bottom: 8px;
        }
        .wb-switch-item label {
            color: #eee;
            font-size: 13px;
            cursor: pointer;
        }
        .wb-switch-item input {
            width: 40px;
            height: 20px;
            appearance: none;
            background: #3a3a4a;
            border-radius: 20px;
            position: relative;
            cursor: pointer;
            transition: all 0.3s;
        }
        .wb-switch-item input:checked {
            background: #ff6b35;
        }
        .wb-switch-item input::before {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: white;
            top: 2px;
            left: 2px;
            transition: all 0.3s;
        }
        .wb-switch-item input:checked::before {
            left: 22px;
        }
        .wb-float-panel.minimized .wb-float-content { display: none; }
        .wb-float-panel.minimized { width: auto; }
        .wb-modal {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .wb-modal-content {
            background: #1e1e2f;
            border-radius: 12px;
            width: 400px;
            max-width: 90%;
            padding: 20px;
            border: 1px solid #3a3a4a;
        }
        .wb-modal-content textarea {
            width: 100%;
            height: 200px;
            padding: 10px;
            background: #2a2a3a;
            border: 1px solid #3a3a4a;
            color: #eee;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            box-sizing: border-box;
        }
        .wb-modal-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 15px;
        }
        .wb-modal-buttons button {
            padding: 6px 16px;
            border-radius: 6px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // ==================== 辅助函数 ====================
    function getUserName(el) {
        let span = el.querySelector('a[usercard] span');
        if (span && span.textContent.trim()) return span.textContent.trim();
        span = el.querySelector('a[href*="/u/"] span');
        if (span && span.textContent.trim()) return span.textContent.trim();
        span = el.querySelector('[class*="_name_"] span');
        return span ? span.textContent.trim() : null;
    }

    function getWeiboText(el) {
        const textEl = el.querySelector('[class*="_wbtext_"]');
        return textEl ? textEl.textContent.trim() : '';
    }

    function getSource(el) {
        const sourceEl = el.querySelector('[class*="_source_"]');
        return sourceEl ? sourceEl.textContent.trim() : '';
    }

    function getSuperTopic(el) {
        const topicEl = el.querySelector('a[class*="_superText_"] span, a[href*="huati"] span');
        return topicEl ? topicEl.textContent.trim() : '';
    }

    function hasSuperTopic(el) {
        const chaohuaIcon = el.querySelector('img[class*="chaohua"], img[class*="Chaohua"], [class*="_chaohuaIcon_"]');
        const superTextLink = el.querySelector('a[class*="_superText_"], a[href*="huati.weibo.com"]');
        return !!(chaohuaIcon || superTextLink);
    }

    function hasBlueV(el) {
        const vipIcons = el.querySelectorAll('[class*="vip"], [class*="verified"], .woo-icon-vipimg, img[src*="vip"]');
        for (const icon of vipIcons) {
            const imgSrc = icon.src || icon.getAttribute('src') || '';
            const title = icon.getAttribute('title') || icon.getAttribute('alt') || '';
            const parent = icon.closest('[class*="icon"]') || icon.parentElement;
            const parentClass = parent ? parent.className : '';

            if (title.includes('蓝V') || title.includes('企业') || title.includes('媒体') || title.includes('机构')) return true;
            if (parentClass.includes('blue') || parentClass.includes('enterprise') || parentClass.includes('company')) return true;
            if (imgSrc && (imgSrc.includes('blue') || imgSrc.includes('enterprise'))) return true;
        }

        const verifiedBadges = el.querySelectorAll('[class*="verified"], [class*="authentication"], [class*="badge"]');
        for (const badge of verifiedBadges) {
            const text = badge.textContent || '';
            const title = badge.getAttribute('title') || '';
            if (text.includes('蓝V') || title.includes('蓝V') || text.includes('企业认证') || title.includes('企业认证')) return true;
        }
        return false;
    }

    function hasAdTag(el) {
        const tags = el.querySelectorAll('[class*="wbpro-tag"]');
        for (const tag of tags) {
            const text = tag.textContent;
            if (text.includes('广告') || text.includes('荐读') || text.includes('推荐')) return true;
        }
        return false;
    }

    function matchesKeyword(text, list) {
        if (!text) return null;
        for (const kw of list) {
            if (!kw) continue;
            if (kw.startsWith('/') && kw.endsWith('/')) {
                try { if (new RegExp(kw.slice(1, -1), 'i').test(text)) return kw; } catch(e) {}
            } else {
                if (text.toLowerCase().includes(kw.toLowerCase())) return kw;
            }
        }
        return null;
    }

    function shouldHide(item) {
        if (hasAdTag(item)) return true;
        if (blockAllSuperTopic && hasSuperTopic(item)) return true;
        if (blockAllBlueV && hasBlueV(item)) return true;

        const userName = getUserName(item);
        if (userName && blockedUsers.some(name => userName.toLowerCase().includes(name.toLowerCase()))) return true;

        const content = getWeiboText(item);
        if (content && matchesKeyword(content, keywords)) return true;

        const source = getSource(item);
        if (source && matchesKeyword(source, sources)) return true;

        if (!blockAllSuperTopic) {
            const topic = getSuperTopic(item);
            if (topic && matchesKeyword(topic, topics)) return true;
        }

        return false;
    }

    // ==================== 核心隐藏 ====================
    function hideContent() {
        const containers = document.querySelectorAll('.vue-recycle-scroller__item-view, .wbpro-scroller-item');
        containers.forEach(container => {
            const article = container.querySelector('article[class*="_wrap_"]');
            if (article) {
                if (shouldHide(article)) {
                    if (container.dataset.hidden !== 'true') {
                        container.classList.add('wb-hidden');
                        container.dataset.hidden = 'true';
                    }
                } else {
                    if (container.dataset.hidden === 'true') {
                        container.classList.remove('wb-hidden');
                        container.dataset.hidden = 'false';
                    }
                }
            }
        });

        const articles = document.querySelectorAll('article[class*="_wrap_"]');
        articles.forEach(article => {
            if (!article.closest('.vue-recycle-scroller__item-view, .wbpro-scroller-item')) {
                if (shouldHide(article)) {
                    if (article.dataset.hidden !== 'true') {
                        article.classList.add('wb-hidden');
                        article.dataset.hidden = 'true';
                    }
                } else {
                    if (article.dataset.hidden === 'true') {
                        article.classList.remove('wb-hidden');
                        article.dataset.hidden = 'false';
                    }
                }
            }
        });
    }

    function refresh() {
        document.querySelectorAll('.wb-hidden').forEach(el => {
            el.classList.remove('wb-hidden');
            delete el.dataset.hidden;
        });
        hideContent();
    }

    function saveData() {
        GM_setValue('wb_keywords', keywords);
        GM_setValue('wb_blocked_users', blockedUsers);
        GM_setValue('wb_sources', sources);
        GM_setValue('wb_topics', topics);
        GM_setValue('wb_block_all_super_topic', blockAllSuperTopic);
        GM_setValue('wb_block_all_blue_v', blockAllBlueV);
    }

    // ==================== 批量导入 ====================
    function showBatchModal(title, currentList, onSave) {
        const modal = document.createElement('div');
        modal.className = 'wb-modal';
        modal.innerHTML = `
            <div class="wb-modal-content">
                <h3 style="margin:0 0 10px 0;color:#eee;">批量导入 ${title}</h3>
                <textarea id="batch-text" placeholder="每行一个，支持正则如 /广告\\d+/"></textarea>
                <div class="wb-modal-buttons">
                    <button id="batch-cancel" style="background:#3a3a4a;border:none;color:#ccc;">取消</button>
                    <button id="batch-save" style="background:#ff6b35;border:none;color:#fff;">导入并合并</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('batch-save').onclick = () => {
            const text = document.getElementById('batch-text').value;
            const newItems = text.split('\n').map(l => l.trim()).filter(l => l);
            const merged = [...new Set([...currentList, ...newItems])];
            onSave(merged);
            modal.remove();
        };
        document.getElementById('batch-cancel').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    // ==================== 悬浮窗 ====================
    let panel = null;
    let dragging = false;
    let offset = { x: 0, y: 0 };
    let panelHidden = false;

    function showPanel() {
        if (panel) {
            panel.style.display = '';
            panelHidden = false;
            return;
        }
        createPanel();
    }

    function hidePanel() {
        if (panel) {
            panel.style.display = 'none';
            panelHidden = true;
        }
    }

    function createPanel() {
        if (panel) return;
        panel = document.createElement('div');
        panel.className = 'wb-float-panel';
        panel.innerHTML = `
            <div class="wb-float-header" id="wb-drag">
                <span>🛡️ 微博屏蔽</span>
                <div>
                    <button id="wb-min">─</button>
                    <button id="wb-close">✕</button>
                </div>
            </div>
            <div class="wb-float-content">
                <div class="wb-switch-item">
                    <label>🚫 屏蔽所有超话帖子</label>
                    <input type="checkbox" id="block-all-supertopic" ${blockAllSuperTopic ? 'checked' : ''}>
                </div>
                <div class="wb-switch-item">
                    <label>🔵 屏蔽所有蓝V认证</label>
                    <input type="checkbox" id="block-all-bluev" ${blockAllBlueV ? 'checked' : ''}>
                </div>
                <div class="wb-section">
                    <div class="wb-section-title">
                        <span>👤 屏蔽用户（输入昵称）</span>
                        <button class="wb-batch-btn" data-type="user">批量导入</button>
                    </div>
                    <div class="wb-input-group">
                        <input id="user-input" placeholder="输入用户名">
                        <button id="add-user">添加</button>
                    </div>
                    <div id="user-list" class="wb-list"></div>
                </div>
                <div class="wb-section">
                    <div class="wb-section-title">
                        <span>🔤 屏蔽关键词</span>
                        <button class="wb-batch-btn" data-type="keyword">批量导入</button>
                    </div>
                    <div class="wb-input-group">
                        <input id="kw-input" placeholder="如：推广 /广告\\d+/">
                        <button id="add-kw">添加</button>
                    </div>
                    <div id="kw-list" class="wb-list"></div>
                </div>
                <div class="wb-section">
                    <div class="wb-section-title">
                        <span>📱 屏蔽来源</span>
                        <button class="wb-batch-btn" data-type="source">批量导入</button>
                    </div>
                    <div class="wb-input-group">
                        <input id="src-input" placeholder="如：iPhone客户端">
                        <button id="add-src">添加</button>
                    </div>
                    <div id="src-list" class="wb-list"></div>
                </div>
                <div class="wb-section">
                    <div class="wb-section-title">
                        <span>🏷️ 屏蔽超话（关键词）</span>
                        <button class="wb-batch-btn" data-type="topic">批量导入</button>
                    </div>
                    <div class="wb-input-group">
                        <input id="topic-input" placeholder="如：黑袍纠察队">
                        <button id="add-topic">添加</button>
                    </div>
                    <div id="topic-list" class="wb-list"></div>
                    <div style="font-size: 11px; color: #666; margin-top: 5px;">提示：开启"屏蔽所有超话"后，此项无效</div>
                </div>
                <div class="wb-footer">
                    <button id="btn-refresh">🔄 刷新屏蔽</button>
                    <button id="btn-clear">🗑️ 清空全部</button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        const superTopicSwitch = document.getElementById('block-all-supertopic');
        superTopicSwitch.addEventListener('change', (e) => {
            blockAllSuperTopic = e.target.checked;
            saveData();
            refresh();
        });

        const blueVSwitch = document.getElementById('block-all-bluev');
        blueVSwitch.addEventListener('change', (e) => {
            blockAllBlueV = e.target.checked;
            saveData();
            refresh();
        });

        function render() {
            renderList('user-list', blockedUsers, (i) => { blockedUsers = blockedUsers.filter(x => x !== i); saveData(); refresh(); render(); });
            renderList('kw-list', keywords, (i) => { keywords = keywords.filter(x => x !== i); saveData(); refresh(); render(); });
            renderList('src-list', sources, (i) => { sources = sources.filter(x => x !== i); saveData(); refresh(); render(); });
            renderList('topic-list', topics, (i) => { topics = topics.filter(x => x !== i); saveData(); refresh(); render(); });
        }

        function renderList(id, items, onRemove) {
            const container = document.getElementById(id);
            if (!container) return;
            if (items.length === 0) { container.innerHTML = '<div class="wb-empty">暂无</div>'; return; }
            container.innerHTML = items.map(item => `<div class="wb-item"><span title="${item}">${item.length > 18 ? item.slice(0,18)+'…' : item}</span><button data-item="${item.replace(/"/g, '&quot;')}">✕</button></div>`).join('');
            container.querySelectorAll('button').forEach(btn => { btn.onclick = () => onRemove(btn.dataset.item); });
        }

        document.getElementById('add-user').onclick = () => { let v = document.getElementById('user-input').value.trim(); if(v && !blockedUsers.includes(v)){ blockedUsers.push(v); saveData(); refresh(); render(); document.getElementById('user-input').value=''; } };
        document.getElementById('add-kw').onclick = () => { let v = document.getElementById('kw-input').value.trim(); if(v && !keywords.includes(v)){ keywords.push(v); saveData(); refresh(); render(); document.getElementById('kw-input').value=''; } };
        document.getElementById('add-src').onclick = () => { let v = document.getElementById('src-input').value.trim(); if(v && !sources.includes(v)){ sources.push(v); saveData(); refresh(); render(); document.getElementById('src-input').value=''; } };
        document.getElementById('add-topic').onclick = () => { let v = document.getElementById('topic-input').value.trim(); if(v && !topics.includes(v)){ topics.push(v); saveData(); refresh(); render(); document.getElementById('topic-input').value=''; } };

        document.querySelectorAll('.wb-batch-btn').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                if (type === 'user') showBatchModal('屏蔽用户', blockedUsers, (newList) => { blockedUsers = newList; saveData(); refresh(); render(); });
                if (type === 'keyword') showBatchModal('屏蔽关键词', keywords, (newList) => { keywords = newList; saveData(); refresh(); render(); });
                if (type === 'source') showBatchModal('屏蔽来源', sources, (newList) => { sources = newList; saveData(); refresh(); render(); });
                if (type === 'topic') showBatchModal('屏蔽超话', topics, (newList) => { topics = newList; saveData(); refresh(); render(); });
            };
        });

        document.getElementById('btn-refresh').onclick = () => refresh();
        document.getElementById('btn-clear').onclick = () => { if(confirm('清空全部？')){ keywords=[]; blockedUsers=[]; sources=[]; topics=[]; saveData(); refresh(); render(); } };

        let minimized = false;
        document.getElementById('wb-min').onclick = () => { minimized = !minimized; panel.classList.toggle('minimized', minimized); document.getElementById('wb-min').textContent = minimized ? '□' : '─'; };
        document.getElementById('wb-close').onclick = () => hidePanel();

        const header = document.getElementById('wb-drag');
        header.onmousedown = (e) => { if(e.target.tagName === 'BUTTON') return; dragging = true; offset.x = e.clientX - panel.offsetLeft; offset.y = e.clientY - panel.offsetTop; document.body.style.userSelect = 'none'; };
        document.onmousemove = (e) => { if(!dragging) return; let l = e.clientX - offset.x, t = e.clientY - offset.y; l = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, l)); t = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, t)); panel.style.left = l + 'px'; panel.style.top = t + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; };
        document.onmouseup = () => { dragging = false; document.body.style.userSelect = ''; };

        render();
    }

    // ==================== 油猴菜单 ====================
    GM_registerMenuCommand('📌 打开屏蔽悬浮窗', showPanel);
    GM_registerMenuCommand('🔄 刷新屏蔽', refresh);
    GM_registerMenuCommand('🗑️ 清空全部屏蔽', () => {
        if(confirm('清空全部屏蔽列表？')) {
            keywords = [];
            blockedUsers = [];
            sources = [];
            topics = [];
            saveData();
            refresh();
            if (panel) {
                const renderEvent = new Event('render');
                panel.dispatchEvent(renderEvent);
            }
        }
    });

    // ==================== 启动 ====================
    function init() {
        hideContent();
        createPanel();

        const observer = new MutationObserver(() => hideContent());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);

    console.log('微博屏蔽已启动 | 终极无空隙版 | 支持屏蔽所有超话和蓝V');
})();
