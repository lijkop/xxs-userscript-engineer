// ==UserScript==
// @name         网页正文一键提取
// @name:en      Web Article Extractor
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  快捷键提取并清洗网页正文（保留链接文字、去除链接 URL）到剪贴板，带可视化快捷键设置面板。
// @description:en Hotkey to extract and clean page article text (keeps link text, drops URLs) to the clipboard, with a hotkey settings panel.
// @author       小小薯 (XXS)
// @homepage     https://github.com/XXS-pickle/userscripts
// @supportURL   https://github.com/XXS-pickle/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/web-article-extractor.user.js
// @downloadURL  https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/web-article-extractor.user.js
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ================= 1. 配置中心 (自动持久化) =================
    const Config = {
        data: {
            hotkey: { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, key: 'C' }
        },
        load() {
            const saved = GM_getValue('web_text_extractor_config', null);
            if (saved) {
                try { this.data = JSON.parse(saved); } catch(e) { console.error('加载配置失败', e); }
            }
        },
        save() {
            GM_setValue('web_text_extractor_config', JSON.stringify(this.data));
        }
    };

    // ================= 2. 核心文本提取与清洗引擎 =================
    const Engine = {
        // 继承自原扩展的高级正文选择器库
        mainSelectors: [
            'main', 'article', '.content', '.main-content', '#content', '#main-content',
            '[role="main"]', '.article', '.post', '.entry', '.blog-post', '.entry-content',
            '.post-content', '.page-content', '.article-content', '.markdown-body',
            '.article-body', '.post-body', '.docs-content', '.thread-content', '.readable-content'
        ],

        isElementVisible(element) {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                return false;
            }
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            return true;
        },

        shouldSkipElement(element) {
            const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'HEAD', 'SVG', 'PATH', 'TEMPLATE', 'IFRAME'];
            if (skipTags.includes(element.tagName)) return true;
            if (!this.isElementVisible(element)) return true;

            // 过滤掉代码块（防止干扰正文阅读）
            if (element.tagName === 'PRE' || element.tagName === 'CODE') {
                const parent = element.closest('article, .content, main, .post-content, .markdown-body');
                if (!parent) return true;
            }
            return false;
        },

        // 深度递归遍历 DOM，核心解决“保留链接文字，抹去链接本身”的需求
        extractVisibleText(element) {
            if (this.shouldSkipElement(element)) return '';

            // 块级元素判定，用于后期追加换行
            const isBlockElement = element.tagName && [
                'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE',
                'BLOCKQUOTE', 'LI', 'HR', 'PRE', 'TABLE', 'TR'
            ].includes(element.tagName);

            if (element.tagName === 'BR') return '\n';

            let text = '';

            // 处理特殊节点：如果是超链接 <a>，依然递归其子节点获取文字，但物理上斩断其 href 属性的影响
            for (const child of element.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    const trimmedText = child.textContent.trim();
                    if (trimmedText) {
                        text += trimmedText + ' ';
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    text += this.extractVisibleText(child);
                }
            }

            if (isBlockElement && text.trim()) {
                text = text.trim() + '\n';
            }

            return text;
        },

        cleanupText(text) {
            if (!text) return '';
            let cleaned = text.replace(/<\/?[^>]+(>|$)/g, ''); // 严格剥离残余HTML
            cleaned = cleaned.replace(/[\t\f\v\u00A0\u2000-\u200A\u202F\u205F\u3000\u200B-\u200D\uFEFF]+/g, ' '); // 规范空白
            cleaned = cleaned.replace(/\r\n?/g, '\n'); // 规范换行
            cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // 连续多换行坍缩为双换行

            cleaned = cleaned.split('\n').map(line => line.trim()).join('\n'); // 掐头去尾

            // 段落去重
            const paragraphs = new Set(cleaned.split('\n\n'));
            cleaned = Array.from(paragraphs).join('\n\n');

            // 物理抹除纯 URL 链接本身（应对正文中裸露的 http 文本）
            cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');

            return cleaned.trim();
        },

        // 智能识别核心流程
        executeExtract() {
            let extractedText = '';

            // 1. 尝试从精准的正文选择器矩阵中提取
            for (const selector of this.mainSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    for (const element of elements) {
                        if (element && this.isElementVisible(element)) {
                            const text = this.extractVisibleText(element);
                            if (text.length > 200 && text.length > extractedText.length) {
                                extractedText = text;
                            }
                        }
                    }
                }
            }

            // 2. 如果选择器没命中，降级提取整个 body 的可见文本
            if (!extractedText) {
                extractedText = this.extractVisibleText(document.body);
            }

            // 3. 穿透处理页面上的 Shadow DOM
            try {
                const allElements = document.querySelectorAll('*');
                for (const host of allElements) {
                    if (host.shadowRoot && this.isElementVisible(host)) {
                        const shadowText = this.extractVisibleText(host.shadowRoot);
                        if (shadowText.length > 100) {
                            extractedText += '\n\n' + shadowText;
                        }
                    }
                }
            } catch (e) { console.log('Shadow DOM 提取跳过', e); }

            return this.cleanupText(extractedText);
        }
    };

    // ================= 3. UI 控制器 (Shadow DOM 独立隔离) =================
    const UI = {
        host: null,
        shadow: null,

        init() {
            // 创建 Shadow DOM 宿主
            this.host = document.createElement('div');
            this.host.id = 'tm-extractor-updater-container';
            this.host.style.cssText = 'position: fixed; z-index: 2147483647;';
            document.body.appendChild(this.host);
            this.shadow = this.host.attachShadow({ mode: 'closed' });

            // 注入高颜值无污染样式
            const style = document.createElement('style');
            style.textContent = `
                .toast {
                    position: fixed; bottom: 30px; right: 30px;
                    background: rgba(32, 33, 36, 0.95); color: #fff;
                    padding: 12px 22px; border-radius: 8px;
                    font-size: 14px; font-family: system-ui, -apple-system;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                    opacity: 0; transform: translateY(20px);
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    pointer-events: none; display: flex; align-items: center; gap: 8px;
                }
                .toast.show { opacity: 1; transform: translateY(0); }
                .panel {
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.9);
                    background: #ffffff; color: #333333; width: 360px;
                    padding: 24px; border-radius: 16px; box-shadow: 0 12px 36px rgba(0,0,0,0.15);
                    font-family: system-ui, -apple-system; opacity: 0; pointer-events: none;
                    transition: all 0.25s ease; border: 1px solid #eaeaea;
                }
                .panel.show { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
                .panel-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
                .panel-close { cursor: pointer; color: #999; font-size: 20px; }
                .panel-close:hover { color: #333; }
                .hotkey-box {
                    background: #f5f5f7; border: 2px dashed #dadce0; border-radius: 8px;
                    padding: 16px; text-align: center; font-size: 16px; font-weight: bold;
                    color: #1a73e8; margin: 12px 0; cursor: pointer; transition: all 0.2s;
                }
                .hotkey-box.recording { background: #e8f0fe; border-color: #1a73e8; color: #1557b0; animation: blink 1s infinite; }
                .tip { font-size: 12px; color: #666; line-height: 1.5; }
                @keyframes blink { 0% {opacity: 1;} 50% {opacity: 0.6;} 100% {opacity: 1;} }
            `;
            this.shadow.appendChild(style);

            // 创建 Toast 节点
            const toastEl = document.createElement('div');
            toastEl.className = 'toast';
            toastEl.id = 'toast';
            this.shadow.appendChild(toastEl);

            // 创建设置面板节点
            const panelEl = document.createElement('div');
            panelEl.className = 'panel';
            panelEl.id = 'panel';
            panelEl.innerHTML = `
                <div class="panel-title"><span>复制助手设置</span><span class="panel-close" id="closePanel">×</span></div>
                <div class="tip">点击下方方框，直接在键盘上按下您想修改的全新快捷键组合：</div>
                <div class="hotkey-box" id="hotkeyBox">加载中...</div>
                <div class="tip" style="color: #999;">配置即时生效，刷新页面后可全局使用。</div>
            `;
            this.shadow.appendChild(panelEl);

            this.bindEvents();
        },

        showToast(message, isError = false) {
            const toast = this.shadow.getElementById('toast');
            toast.style.background = isError ? 'rgba(217, 48, 37, 0.95)' : 'rgba(32, 33, 36, 0.95)';
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        },

        showPanel() {
            this.updateHotkeyBoxDisplay();
            this.shadow.getElementById('panel').classList.add('show');
        },

        hidePanel() {
            this.shadow.getElementById('panel').classList.remove('show');
            this.shadow.getElementById('hotkeyBox').classList.remove('recording');
        },

        updateHotkeyBoxDisplay() {
            const h = Config.data.hotkey;
            let parts = [];
            if (h.ctrlKey) parts.push('Ctrl');
            if (h.altKey) parts.push('Alt');
            if (h.shiftKey) parts.push('Shift');
            if (h.metaKey) parts.push('Meta');
            if (h.key) parts.push(h.key.toUpperCase());
            this.shadow.getElementById('hotkeyBox').textContent = parts.join(' + ') || '未设置快捷键';
        },

        bindEvents() {
            this.shadow.getElementById('closePanel').addEventListener('click', () => this.hidePanel());

            const hotkeyBox = this.shadow.getElementById('hotkeyBox');
            let isRecording = false;

            hotkeyBox.addEventListener('click', () => {
                isRecording = true;
                hotkeyBox.classList.add('recording');
                hotkeyBox.textContent = '请在键盘上按下新快捷键...';
            });

            window.addEventListener('keydown', (e) => {
                if (!isRecording) return;

                // 忽略单独按下修饰键的瞬间
                if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

                e.preventDefault();
                e.stopPropagation();

                Config.data.hotkey = {
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                    metaKey: e.metaKey,
                    key: e.key.toUpperCase()
                };

                Config.save();
                isRecording = false;
                hotkeyBox.classList.remove('recording');
                this.updateHotkeyBoxDisplay();
                this.showToast('快捷键成功修改为：' + hotkeyBox.textContent);
            }, true);
        }
    };

    // ================= 4. 监听与生命周期调度 =================
    const Boot = () => {
        Config.load();
        UI.init();

        // 注册油猴菜单，方便随时唤出快捷键配置面板
        GM_registerMenuCommand('⚙️ 修改无感复制快捷键', () => {
            UI.showPanel();
        });

        // 全局键盘监听器
        window.addEventListener('keydown', async (e) => {
            const h = Config.data.hotkey;

            // 严密的快捷键匹配校验
            if (
                e.ctrlKey === h.ctrlKey &&
                e.altKey === h.altKey &&
                e.shiftKey === h.shiftKey &&
                e.metaKey === h.metaKey &&
                e.key.toUpperCase() === h.key.toUpperCase()
            ) {
                e.preventDefault();
                e.stopPropagation();

                try {
                    // 调用核心引擎
                    const cleanedText = Engine.executeExtract();

                    if (!cleanedText) {
                        UI.showToast('⚠️ 未能在此页面识别到有效正文内容', true);
                        return;
                    }

                    // 写入系统剪贴板
                    await navigator.clipboard.writeText(cleanedText);

                    // 智能字数截取反馈
                    const count = cleanedText.length;
                    const preview = count > 15 ? cleanedText.substring(0, 15) + '...' : cleanedText;
                    UI.showToast(`✨ 成功提取并清洗正文 (${count}字)："${preview}"`);

                } catch (err) {
                    console.error('复制失败:', err);
                    UI.showToast('❌ 复制失败，请确认允许网页访问剪贴板', true);
                }
            }
        }, true);
    };

    Boot();
})();
