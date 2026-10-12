// ==UserScript==
// @name         豆瓣小组关键词屏蔽器
// @name:en      Douban Group Keyword Blocker
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  屏蔽豆瓣小组中标签或标题命中关键词的帖子。
// @description:en Hide Douban group topics whose tags or titles match your keywords.
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/douban-group-keyword-blocker.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/douban-group-keyword-blocker.user.js
// @match        https://www.douban.com/group/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 配置键名
    const CONFIG_KEYS = {
        TAGS: 'blocked_tags',
        TITLES: 'blocked_titles'
    };

    // 默认关键词
    const DEFAULT_BLOCKED_TAGS = ['韩剧', '美剧'];
    const DEFAULT_BLOCKED_TITLES = ['好想要一个抽纸盒'];

    // 获取存储的关键词
    function getBlockedKeywords(type) {
        const key = type === 'tags' ? CONFIG_KEYS.TAGS : CONFIG_KEYS.TITLES;
        const stored = GM_getValue(key);
        if (stored === undefined) {
            // 首次使用，设置默认值
            const defaults = type === 'tags' ? DEFAULT_BLOCKED_TAGS : DEFAULT_BLOCKED_TITLES;
            GM_setValue(key, JSON.stringify(defaults));
            return defaults;
        }
        try {
            return JSON.parse(stored);
        } catch (e) {
            return [];
        }
    }

    // 保存关键词
    function saveBlockedKeywords(type, keywords) {
        const key = type === 'tags' ? CONFIG_KEYS.TAGS : CONFIG_KEYS.TITLES;
        GM_setValue(key, JSON.stringify(keywords));
    }

    // 添加关键词
    function addKeyword(type, keyword) {
        if (!keyword || !keyword.trim()) return false;
        const keywords = getBlockedKeywords(type);
        const trimmed = keyword.trim();
        if (!keywords.includes(trimmed)) {
            keywords.push(trimmed);
            saveBlockedKeywords(type, keywords);
            return true;
        }
        return false;
    }

    // 删除关键词
    function removeKeyword(type, keyword) {
        const keywords = getBlockedKeywords(type);
        const index = keywords.indexOf(keyword);
        if (index > -1) {
            keywords.splice(index, 1);
            saveBlockedKeywords(type, keywords);
            return true;
        }
        return false;
    }

    // 检查是否应该屏蔽
    function shouldBlock(element) {
        // 获取标题文本
        const titleLink = element.querySelector('.title');
        if (!titleLink) return false;

        const titleText = titleLink.textContent.trim();

        // 检查标题关键词
        const blockedTitles = getBlockedKeywords('titles');
        for (const keyword of blockedTitles) {
            if (titleText.includes(keyword)) {
                return true;
            }
        }

        // 获取标签文本
        const groupLink = element.querySelector('.td-group a');
        if (groupLink) {
            const groupText = groupLink.textContent.trim();
            const blockedTags = getBlockedKeywords('tags');
            if (blockedTags.includes(groupText)) {
                return true;
            }
        }

        return false;
    }

    // 屏蔽话题
    function blockTopics() {
        const topicRows = document.querySelectorAll('tr.pl');
        let blockedCount = 0;

        topicRows.forEach(row => {
            // 跳过已处理的行（避免重复处理）
            if (row.dataset.filtered === 'true') return;

            if (shouldBlock(row)) {
                row.style.display = 'none';
                blockedCount++;
            }
            // 标记为已处理
            row.dataset.filtered = 'true';
        });

        // 更新屏蔽计数
        const counter = document.getElementById('filter-counter');
        if (counter) {
            const totalBlocked = document.querySelectorAll('tr.pl[style*="none"]').length;
            counter.textContent = `已屏蔽: ${totalBlocked} 条`;
        }
    }

    // 处理新添加的节点
    function handleNewNodes(mutations) {
        let hasNewTopics = false;

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                // 检查是否是话题行
                if (node.nodeType === 1) { // Element node
                    if (node.classList && node.classList.contains('pl')) {
                        hasNewTopics = true;
                    }
                    // 检查子元素中是否有话题行
                    if (node.querySelectorAll) {
                        const newRows = node.querySelectorAll('tr.pl');
                        if (newRows.length > 0) {
                            hasNewTopics = true;
                        }
                    }
                }
            });
        });

        // 如果有新话题，应用过滤
        if (hasNewTopics) {
            setTimeout(() => blockTopics(), 100); // 延迟执行，确保内容已加载
        }
    }

    // 创建控制面板
    function createControlPanel() {
        // 创建面板容器
        const panel = document.createElement('div');
        panel.id = 'douban-filter-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            width: 300px;
            max-height: 500px;
            overflow-y: auto;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // 创建标题
        const title = document.createElement('h3');
        title.textContent = '豆瓣小组屏蔽设置';
        title.style.cssText = `
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #333;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        `;

        // 创建计数器
        const counter = document.createElement('div');
        counter.id = 'filter-counter';
        counter.style.cssText = `
            margin-bottom: 15px;
            font-size: 14px;
            color: #666;
            font-weight: bold;
        `;

        // 创建标签关键词区域
        const tagsSection = createKeywordSection('tags', '屏蔽标签', '输入要屏蔽的标签');

        // 创建标题关键词区域
        const titlesSection = createKeywordSection('titles', '屏蔽标题关键词', '输入要屏蔽的标题关键词');

        // 创建按钮区域
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            margin-top: 15px;
            display: flex;
            gap: 10px;
        `;

        // 创建应用按钮
        const applyButton = document.createElement('button');
        applyButton.textContent = '应用屏蔽';
        applyButton.style.cssText = `
            flex: 1;
            padding: 8px 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        applyButton.onmouseover = () => applyButton.style.background = '#45a049';
        applyButton.onmouseout = () => applyButton.style.background = '#4CAF50';
        applyButton.onclick = () => {
            blockTopics();
        };

        // 创建关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = `
            flex: 1;
            padding: 8px 16px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        closeButton.onmouseover = () => closeButton.style.background = '#da190b';
        closeButton.onmouseout = () => closeButton.style.background = '#f44336';
        closeButton.onclick = () => {
            panel.style.display = 'none';
            toggleButton.style.display = 'block';
        };

        buttonContainer.appendChild(applyButton);
        buttonContainer.appendChild(closeButton);

        panel.appendChild(title);
        panel.appendChild(counter);
        panel.appendChild(tagsSection);
        panel.appendChild(titlesSection);
        panel.appendChild(buttonContainer);

        document.body.appendChild(panel);

        return panel;
    }

    // 创建关键词管理区域
    function createKeywordSection(type, label, placeholder) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-bottom: 15px;
        `;

        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = label;
        sectionTitle.style.cssText = `
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #333;
        `;

        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.style.cssText = `
            flex: 1;
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 13px;
        `;

        const addButton = document.createElement('button');
        addButton.textContent = '添加';
        addButton.style.cssText = `
            padding: 6px 12px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            white-space: nowrap;
        `;
        addButton.onmouseover = () => addButton.style.background = '#0b7dda';
        addButton.onmouseout = () => addButton.style.background = '#2196F3';

        const keywordsList = document.createElement('div');
        keywordsList.style.cssText = `
            max-height: 120px;
            overflow-y: auto;
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 8px;
        `;

        // 渲染关键词列表
        function renderKeywords() {
            const keywords = getBlockedKeywords(type);
            keywordsList.innerHTML = '';

            if (keywords.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.textContent = '暂无屏蔽关键词';
                emptyMsg.style.cssText = `
                    color: #999;
                    font-size: 12px;
                    text-align: center;
                    padding: 10px;
                `;
                keywordsList.appendChild(emptyMsg);
                return;
            }

            keywords.forEach(keyword => {
                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 0;
                    border-bottom: 1px solid #f0f0f0;
                `;

                const text = document.createElement('span');
                text.textContent = keyword;
                text.style.cssText = `
                    font-size: 13px;
                    color: #333;
                    word-break: break-word;
                `;

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '删除';
                deleteBtn.style.cssText = `
                    padding: 2px 8px;
                    background: #ff9800;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                `;
                deleteBtn.onmouseover = () => deleteBtn.style.background = '#e68900';
                deleteBtn.onmouseout = () => deleteBtn.style.background = '#ff9800';
                deleteBtn.onclick = () => {
                    if (removeKeyword(type, keyword)) {
                        renderKeywords();
                        // 清除已处理标记，重新扫描所有内容（包括动态加载的）
                        document.querySelectorAll('tr.pl').forEach(row => {
                            delete row.dataset.filtered;
                        });
                        blockTopics(); // 实时更新屏蔽结果
                    }
                };

                item.appendChild(text);
                item.appendChild(deleteBtn);
                keywordsList.appendChild(item);
            });
        }

        // 添加关键词事件
        addButton.onclick = () => {
            const keyword = input.value.trim();
            if (addKeyword(type, keyword)) {
                input.value = '';
                renderKeywords();
                // 清除已处理标记，重新扫描所有内容（包括动态加载的）
                document.querySelectorAll('tr.pl').forEach(row => {
                    delete row.dataset.filtered;
                });
                blockTopics(); // 实时更新屏蔽结果
            } else if (keyword) {
                alert('关键词已存在或为空！');
            }
        };

        // 回车键添加
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addButton.click();
            }
        });

        inputContainer.appendChild(input);
        inputContainer.appendChild(addButton);

        container.appendChild(sectionTitle);
        container.appendChild(inputContainer);
        container.appendChild(keywordsList);

        // 初始渲染
        renderKeywords();

        return container;
    }

    // 创建切换按钮
    function createToggleButton() {
        const toggleButton = document.createElement('button');
        toggleButton.id = 'douban-filter-toggle';
        toggleButton.textContent = '屏蔽设置';
        toggleButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            z-index: 9998;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        toggleButton.onmouseover = () => {
            toggleButton.style.background = '#45a049';
            toggleButton.style.transform = 'scale(1.05)';
        };
        toggleButton.onmouseout = () => {
            toggleButton.style.background = '#4CAF50';
            toggleButton.style.transform = 'scale(1)';
        };
        toggleButton.onclick = () => {
            const panel = document.getElementById('douban-filter-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        };

        document.body.appendChild(toggleButton);
        return toggleButton;
    }

    // 初始化
    function init() {
        // 等待页面加载完成
        setTimeout(() => {
            // 创建面板
            const panel = createControlPanel();

            // 创建切换按钮
            const toggleButton = createToggleButton();

            // 初始屏蔽
            blockTopics();

            // 监听整个文档变化，动态屏蔽新加载的内容（兼容自动翻页脚本）
            const observer = new MutationObserver((mutations) => {
                handleNewNodes(mutations);
            });

            // 观察document.body，捕获所有动态添加的内容
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('豆瓣小组屏蔽脚本已加载（兼容自动翻页）');
        }, 1000);
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
