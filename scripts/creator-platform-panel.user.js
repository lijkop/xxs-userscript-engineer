// ==UserScript==
// @name         创作者跨平台管理面板
// @name:en      Creator Cross-Platform Panel
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  为跨平台创作者提供常驻导航面板，支持边缘吸附、平台与标签筛选、备注、数据导入导出。
// @description:en A persistent navigation panel for cross-platform creators: edge docking, platform/tag filtering, notes, data import/export.
// @author       小小薯 (XXS)
// @homepage     https://github.com/XXS-pickle/userscripts
// @supportURL   https://github.com/XXS-pickle/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/creator-platform-panel.user.js
// @downloadURL  https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/creator-platform-panel.user.js
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // 默认预设平台
    const DEFAULT_PLATFORMS = ['B站', '微博', '知乎', '小红书', '微信公众号', '抖音', 'YouTube', 'X/Twitter', '其他'];

    // 数据持久化
    const STORAGE_KEY = 'CREATORS_DATA';
    const PLATFORMS_KEY = 'CREATORS_PLATFORMS';

    function getCreators() {
        return GM_getValue(STORAGE_KEY, []);
    }
    function saveCreators(data) {
        GM_setValue(STORAGE_KEY, data);
    }
    function getCustomPlatforms() {
        return GM_getValue(PLATFORMS_KEY, DEFAULT_PLATFORMS);
    }
    function saveCustomPlatforms(platforms) {
        GM_setValue(PLATFORMS_KEY, platforms);
    }

    // 注册油猴原生菜单
    GM_registerMenuCommand("📡 打开/关闭创作者面板", () => {
        togglePanel(mask.style.display !== 'block');
    });

    // 注入 CSS 样式
    const style = document.createElement('style');
    style.innerHTML = `
        /* 1. 边缘贴边吸附悬浮球 */
        #cm-edge-btn {
            position: fixed; top: 50%; right: 0; transform: translateY(-50%);
            width: 6px; height: 48px; background: #2b5cff;
            border-top-left-radius: 6px; border-bottom-left-radius: 6px;
            z-index: 999998; cursor: pointer; transition: all 0.25s ease;
            box-shadow: -2px 0 8px rgba(0,0,0,0.15); opacity: 0.6;
            display: flex; align-items: center; justify-content: center;
            color: #fff; font-size: 14px; overflow: hidden; whitespace: nowrap;
        }
        #cm-edge-btn:hover {
            width: 36px; opacity: 1; opacity: 1;
        }
        #cm-edge-btn::after {
            content: '📡';
        }

        /* 2. 主面板遮罩与容器 */
        #cm-panel-mask {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.35); z-index: 999999; display: none;
            backdrop-filter: blur(3px);
        }
        #cm-panel {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 720px; max-width: 92vw; height: 600px; background: #ffffff;
            border-radius: 12px; box-shadow: 0 12px 36px rgba(0,0,0,0.22);
            display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #333; overflow: hidden; font-size: 14px;
        }
        .cm-header {
            padding: 14px 20px; background: #f8f9fa; border-bottom: 1px solid #eee;
            display: flex; justify-content: space-between; align-items: center;
        }
        .cm-title { font-weight: 600; font-size: 16px; }
        .cm-close { cursor: pointer; font-size: 18px; color: #888; transition: color 0.2s; }
        .cm-close:hover { color: #000; }

        .cm-toolbar {
            padding: 12px 20px; display: flex; gap: 10px; border-bottom: 1px solid #f0f0f0;
            background: #fff; align-items: center; flex-wrap: wrap;
        }
        .cm-input, .cm-select {
            padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; outline: none; font-size: 13px;
        }
        .cm-btn {
            padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer;
            background: #2b5cff; color: #fff; font-size: 13px; transition: opacity 0.2s;
        }
        .cm-btn:hover { opacity: 0.9; }
        .cm-btn-secondary { background: #e9ecef; color: #495057; }

        .cm-tags-bar { padding: 8px 20px; background: #fafafa; display: flex; gap: 6px; overflow-x: auto; border-bottom: 1px solid #f0f0f0; }
        .cm-tag-chip {
            padding: 2px 10px; border-radius: 12px; background: #e9ecef; color: #495057;
            font-size: 12px; cursor: pointer; white-space: nowrap; transition: all 0.2s;
        }
        .cm-tag-chip.active { background: #2b5cff; color: #fff; }

        /* 3. 卡片布局 */
        .cm-body { flex: 1; padding: 16px 20px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; align-content: start; }
        .cm-card {
            border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; background: #fff;
            display: flex; flex-direction: column; justify-content: space-between; gap: 8px;
            transition: box-shadow 0.2s, border-color 0.2s; position: relative;
        }
        .cm-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #2b5cff; }
        .cm-card-visited-today { background-color: #f8f9fa; opacity: 0.85; }
        .cm-card-name { font-weight: 600; color: #1a1a1a; cursor: pointer; text-decoration: none; word-break: break-all; }
        .cm-card-name:hover { color: #2b5cff; }
        .cm-card-note { font-size: 12px; color: #666; background: #f8f9fa; padding: 4px 6px; border-radius: 4px; word-break: break-all; margin-top: 2px; }
        .cm-card-meta { font-size: 11px; color: #888; display: flex; justify-content: space-between; margin-top: 4px; }
        .cm-card-tags { display: flex; gap: 4px; flex-wrap: wrap; }
        .cm-card-tag { font-size: 10px; background: #e7f0ff; color: #2b5cff; padding: 1px 6px; border-radius: 4px; }
        .cm-card-actions { display: flex; gap: 10px; font-size: 12px; justify-content: flex-end; }
        .cm-action-link { color: #888; cursor: pointer; }
        .cm-action-link:hover { color: #2b5cff; }

        /* 4. 弹窗与多选 */
        .cm-modal {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.98);
            display: none; flex-direction: column; padding: 24px; box-sizing: border-box; gap: 12px; z-index: 10; overflow-y: auto;
        }
        .cm-form-group { display: flex; flex-direction: column; gap: 4px; }
        .cm-form-group label { font-size: 12px; font-weight: 600; color: #555; }
        .cm-tag-select-group { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
        .cm-tag-checkbox {
            padding: 3px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; cursor: pointer; user-select: none;
        }
        .cm-tag-checkbox.selected { background: #2b5cff; color: #fff; border-color: #2b5cff; }
    `;
    document.head.appendChild(style);

    // 构建边缘悬浮球
    const edgeBtn = document.createElement('div');
    edgeBtn.id = 'cm-edge-btn';
    edgeBtn.title = '打开创作者管理面板 (Ctrl+Shift+M)';
    document.body.appendChild(edgeBtn);

    // 构建面板 DOM
    const mask = document.createElement('div');
    mask.id = 'cm-panel-mask';
    mask.innerHTML = `
        <div id="cm-panel">
            <div class="cm-header">
                <span class="cm-title">📡 创作者导航面板</span>
                <span class="cm-close" id="cm-close-btn">✕</span>
            </div>
            <div class="cm-toolbar">
                <input type="text" class="cm-input" id="cm-search" placeholder="搜索昵称/平台/备注..." style="flex:1;">
                <button class="cm-btn" id="cm-add-btn">+ 添加创作者</button>
                <button class="cm-btn cm-btn-secondary" id="cm-export-btn">导出</button>
                <button class="cm-btn cm-btn-secondary" id="cm-import-btn">导入</button>
                <input type="file" id="cm-file-input" accept=".json" style="display:none;">
            </div>
            <div class="cm-tags-bar" id="cm-tags-bar"></div>
            <div class="cm-body" id="cm-body"></div>

            <!-- 编辑/新增 弹窗 -->
            <div class="cm-modal" id="cm-modal">
                <h3 id="cm-modal-title" style="margin:0 0 6px 0;">添加创作者</h3>
                <input type="hidden" id="cm-edit-id">
                <div class="cm-form-group">
                    <label>昵称 / 备注名</label>
                    <input type="text" class="cm-input" id="cm-form-name">
                </div>
                <div class="cm-form-group">
                    <label>个人主页链接</label>
                    <input type="text" class="cm-input" id="cm-form-url">
                </div>
                <div class="cm-form-group">
                    <label>所属平台</label>
                    <div style="display:flex; gap:8px;">
                        <select class="cm-select" id="cm-form-platform" style="flex:1;"></select>
                        <input type="text" class="cm-input" id="cm-form-custom-platform" placeholder="输入新平台" style="display:none; flex:1;">
                    </div>
                </div>
                <div class="cm-form-group">
                    <label>选择已有标签 (最多选 3 个)</label>
                    <div class="cm-tag-select-group" id="cm-exist-tags"></div>
                </div>
                <div class="cm-form-group">
                    <label>新建标签 (用逗号分隔，可选)</label>
                    <input type="text" class="cm-input" id="cm-form-new-tags" placeholder="如: AI, 前端">
                </div>
                <div class="cm-form-group">
                    <label>备注 (干嘛的 / 介绍)</label>
                    <input type="text" class="cm-input" id="cm-form-note" placeholder="例如：经常分享 Docker 和开源项目">
                </div>
                <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:8px;">
                    <button class="cm-btn cm-btn-secondary" id="cm-modal-cancel">取消</button>
                    <button class="cm-btn" id="cm-modal-save">保存</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(mask);

    // 交互与渲染状态
    let activeTag = 'ALL';
    let searchQuery = '';
    let selectedTagsInModal = new Set();

    function togglePanel(show) {
        mask.style.display = show ? 'block' : 'none';
        if (show) render();
    }

    function getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    function render() {
        const creators = getCreators();
        const body = document.getElementById('cm-body');
        const tagsBar = document.getElementById('cm-tags-bar');

        // 收集所有标签
        const allTags = new Set();
        creators.forEach(c => (c.tags || []).forEach(t => allTags.add(t)));

        // 渲染顶部标签栏
        tagsBar.innerHTML = `<div class="cm-tag-chip ${activeTag === 'ALL' ? 'active' : ''}" data-tag="ALL">全部 (${creators.length})</div>`;
        allTags.forEach(tag => {
            const count = creators.filter(c => (c.tags || []).includes(tag)).length;
            tagsBar.innerHTML += `<div class="cm-tag-chip ${activeTag === tag ? 'active' : ''}" data-tag="${tag}">${tag} (${count})</div>`;
        });

        // 过滤数据
        const filtered = creators.filter(c => {
            const matchesTag = activeTag === 'ALL' || (c.tags || []).includes(activeTag);
            const matchesSearch = !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.platform && c.platform.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (c.note && c.note.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesTag && matchesSearch;
        });

        // 渲染卡片
        body.innerHTML = '';
        if (filtered.length === 0) {
            body.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#999; padding: 40px 0;">暂无匹配数据</div>`;
            return;
        }

        const today = getTodayStr();

        filtered.forEach(item => {
            const isVisitedToday = item.lastVisit === today;
            const card = document.createElement('div');
            card.className = `cm-card ${isVisitedToday ? 'cm-card-visited-today' : ''}`;
            card.innerHTML = `
                <div>
                    <div style="font-size:11px; color:#2b5cff; font-weight:600; margin-bottom:2px;">
                        ${item.platform || '未分类'} ${isVisitedToday ? '✓ 今日已看' : ''}
                    </div>
                    <a class="cm-card-name" data-id="${item.id}" href="${item.url}" target="_blank">${item.name}</a>
                    ${item.note ? `<div class="cm-card-note">${item.note}</div>` : ''}
                </div>
                <div class="cm-card-tags">
                    ${(item.tags || []).map(t => `<span class="cm-card-tag">${t}</span>`).join('')}
                </div>
                <div class="cm-card-meta">
                    <span>上次访问: ${item.lastVisit || '从未'}</span>
                </div>
                <div class="cm-card-actions">
                    <span class="cm-action-link cm-edit-btn" data-id="${item.id}">编辑</span>
                    <span class="cm-action-link cm-delete-btn" data-id="${item.id}" style="color:#ff4d4f;">删除</span>
                </div>
            `;
            body.appendChild(card);
        });
    }

    // 事件绑定：悬浮球与快捷键
    edgeBtn.onclick = () => togglePanel(true);
    document.getElementById('cm-close-btn').onclick = () => togglePanel(false);

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
            e.preventDefault();
            togglePanel(mask.style.display !== 'block');
        }
    });

    // 标签筛选与搜索
    document.getElementById('cm-tags-bar').onclick = (e) => {
        if (e.target.classList.contains('cm-tag-chip')) {
            activeTag = e.target.dataset.tag;
            render();
        }
    };

    document.getElementById('cm-search').oninput = (e) => {
        searchQuery = e.target.value.trim();
        render();
    };

    // 卡片事件处理（点击打卡/编辑/删除）
    document.getElementById('cm-body').onclick = (e) => {
        if (e.target.classList.contains('cm-card-name')) {
            const id = e.target.dataset.id;
            const creators = getCreators();
            const target = creators.find(c => c.id === id);
            if (target) {
                target.lastVisit = getTodayStr();
                saveCreators(creators);
                render();
            }
        } else if (e.target.classList.contains('cm-edit-btn')) {
            openFormModal(e.target.dataset.id);
        } else if (e.target.classList.contains('cm-delete-btn')) {
            if (confirm('确定要删除该创作者吗？')) {
                const id = e.target.dataset.id;
                saveCreators(getCreators().filter(c => c.id !== id));
                render();
            }
        }
    };

    // 渲染弹窗中的下拉框与标签勾选项
    function setupModalDropdowns(selectedPlatform = '', existingItemTags = []) {
        const platformSelect = document.getElementById('cm-form-platform');
        const customInput = document.getElementById('cm-form-custom-platform');
        const platforms = getCustomPlatforms();

        platformSelect.innerHTML = platforms.map(p => `<option value="${p}">${p}</option>`).join('');

        if (selectedPlatform && !platforms.includes(selectedPlatform)) {
            platformSelect.value = '其他';
            customInput.style.display = 'block';
            customInput.value = selectedPlatform;
        } else {
            platformSelect.value = selectedPlatform || platforms[0];
            customInput.style.display = platformSelect.value === '其他' ? 'block' : 'none';
            customInput.value = '';
        }

        platformSelect.onchange = () => {
            customInput.style.display = platformSelect.value === '其他' ? 'block' : 'none';
        };

        // 渲染已有标签选择
        const creators = getCreators();
        const allTags = new Set();
        creators.forEach(c => (c.tags || []).forEach(t => allTags.add(t)));

        selectedTagsInModal = new Set(existingItemTags);
        const tagsContainer = document.getElementById('cm-exist-tags');
        tagsContainer.innerHTML = '';

        if (allTags.size === 0) {
            tagsContainer.innerHTML = `<span style="font-size:12px; color:#999;">无历史标签，请直接在下方新建</span>`;
        } else {
            allTags.forEach(tag => {
                const tagEl = document.createElement('div');
                tagEl.className = `cm-tag-checkbox ${selectedTagsInModal.has(tag) ? 'selected' : ''}`;
                tagEl.innerText = tag;
                tagEl.onclick = () => {
                    if (selectedTagsInModal.has(tag)) {
                        selectedTagsInModal.delete(tag);
                        tagEl.classList.remove('selected');
                    } else {
                        if (selectedTagsInModal.size >= 3) {
                            alert('最多选择 3 个标签');
                            return;
                        }
                        selectedTagsInModal.add(tag);
                        tagEl.classList.add('selected');
                    }
                };
                tagsContainer.appendChild(tagEl);
            });
        }
    }

    // 打开编辑/新增弹窗
    const modal = document.getElementById('cm-modal');
    function openFormModal(id = null) {
        modal.style.display = 'flex';
        if (id) {
            const item = getCreators().find(c => c.id === id);
            document.getElementById('cm-modal-title').innerText = '编辑创作者';
            document.getElementById('cm-edit-id').value = item.id;
            document.getElementById('cm-form-name').value = item.name;
            document.getElementById('cm-form-url').value = item.url;
            document.getElementById('cm-form-note').value = item.note || '';
            document.getElementById('cm-form-new-tags').value = '';
            setupModalDropdowns(item.platform, item.tags || []);
        } else {
            document.getElementById('cm-modal-title').innerText = '添加创作者';
            document.getElementById('cm-edit-id').value = '';
            document.getElementById('cm-form-name').value = document.title;
            document.getElementById('cm-form-url').value = window.location.href;
            document.getElementById('cm-form-note').value = '';
            document.getElementById('cm-form-new-tags').value = '';
            setupModalDropdowns('', []);
        }
    }

    document.getElementById('cm-add-btn').onclick = () => openFormModal();
    document.getElementById('cm-modal-cancel').onclick = () => modal.style.display = 'none';

    // 保存创作者表单
    document.getElementById('cm-modal-save').onclick = () => {
        const name = document.getElementById('cm-form-name').value.trim();
        const url = document.getElementById('cm-form-url').value.trim();
        const note = document.getElementById('cm-form-note').value.trim();
        const editId = document.getElementById('cm-edit-id').value;

        let platform = document.getElementById('cm-form-platform').value;
        if (platform === '其他') {
            const customP = document.getElementById('cm-form-custom-platform').value.trim();
            if (customP) {
                platform = customP;
                const platforms = getCustomPlatforms();
                if (!platforms.includes(customP)) {
                    platforms.splice(platforms.length - 1, 0, customP);
                    saveCustomPlatforms(platforms);
                }
            }
        }

        if (!name || !url) {
            alert('请填写昵称和 URL');
            return;
        }

        // 提取新标签并合并
        const newTagsRaw = document.getElementById('cm-form-new-tags').value;
        const newTags = newTagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        const finalTags = Array.from(new Set([...Array.from(selectedTagsInModal), ...newTags])).slice(0, 3);

        const creators = getCreators();

        if (editId) {
            const item = creators.find(c => c.id === editId);
            if (item) {
                item.name = name;
                item.url = url;
                item.platform = platform;
                item.tags = finalTags;
                item.note = note;
            }
        } else {
            creators.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                name,
                url,
                platform,
                tags: finalTags,
                note,
                lastVisit: '',
                createdAt: getTodayStr()
            });
        }

        saveCreators(creators);
        modal.style.display = 'none';
        render();
    };

    // JSON 导出/导入
    document.getElementById('cm-export-btn').onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getCreators(), null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `creators_backup_${getTodayStr()}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    };

    const fileInput = document.getElementById('cm-file-input');
    document.getElementById('cm-import-btn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    saveCreators(importedData);
                    render();
                    alert('导入成功！');
                } else {
                    alert('格式不正确');
                }
            } catch (err) {
                alert('解析 JSON 文件失败');
            }
        };
        reader.readAsText(file);
    };
})();
