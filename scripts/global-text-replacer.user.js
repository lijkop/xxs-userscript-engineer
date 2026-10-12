// ==UserScript==
// @name         全网文本替换器
// @name:en      Global Text Replacer
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  按自定义规则在全网页面替换文本内容，适配 React/Vue 与虚拟列表，支持首次加载、动态变更与定时兜底。
// @description:en Replace text on any site with custom rules; works with React/Vue and virtual lists, covering first load, dynamic updates and periodic sweeps.
// @author       小小薯 (XXS)
// @homepage     https://github.com/XXS-pickle/userscripts
// @supportURL   https://github.com/XXS-pickle/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/global-text-replacer.user.js
// @downloadURL  https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/global-text-replacer.user.js
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    // ==========================================
    // 1. 配置与数据持久化中心
    // ==========================================
    const Config = {
        storageKey: 'text_rewriter_config_ultra_hide',
        data: {
            rules: [
                { id: '1', mode: 'text', from: '张三', to: '老张（同学）', enabled: true },
                { id: '2', mode: 'regex', from: '(\\d{4})-(\\d{2})-(\\d{2})', to: '$1年$2月$3日', enabled: true }
            ],
            blacklist: []
        },
        load() {
            const saved = GM_getValue(this.storageKey, null);
            if (saved) {
                try { this.data = Object.assign({}, this.data, JSON.parse(saved)); }
                catch(e){ console.error("加载配置失败", e);}
            }
        },
        save() { GM_setValue(this.storageKey, JSON.stringify(this.data)); },
        isCurrentDomainDisabled() { return this.data.blacklist.includes(window.location.hostname); },
        toggleCurrentDomain() {
            const host = window.location.hostname;
            const idx = this.data.blacklist.indexOf(host);
            if (idx > -1) this.data.blacklist.splice(idx,1);
            else this.data.blacklist.push(host);
            this.save();
        }
    };

    // ==========================================
    // 2. 核心替换引擎（加装防套娃隔离盾）
    // ==========================================
    const Engine = {
        observer: null,
        isProcessing: false,

        processTextNode(node) {
            if (!node || node.nodeType !== Node.TEXT_NODE) return;

            // 关键防御：如果父级节点已经被贴上“已处理”标签，直接跳过，防止无限流
            const parent = node.parentElement;
            if (parent && parent.hasAttribute('data-text-rewritten')) return;

            let text = node.nodeValue;
            if (!text || text.trim() === '') return;
            let changed = false;

            for (const rule of Config.data.rules) {
                if (!rule.enabled || !rule.from) continue;
                if (rule.mode === 'regex') {
                    try {
                        const regex = new RegExp(rule.from, 'g');
                        if(regex.test(text)){ text = text.replace(regex, rule.to||''); changed=true; }
                    } catch(e){}
                } else {
                    if(text.includes(rule.from)){ text=text.split(rule.from).join(rule.to||''); changed=true;}
                }
            }

            if(changed && node.nodeValue!==text){
                node.nodeValue=text;
                // 关键打标：给父级元素盖个章，告诉脚本这个地方别再动了
                if (parent) {
                    parent.setAttribute('data-text-rewritten', 'true');
                }
            }
        },

        walk(root){
            const walker = document.createTreeWalker(
                root, NodeFilter.SHOW_TEXT,
                { acceptNode: (node)=>{
                    const parent=node.parentElement;
                    if(!parent) return NodeFilter.FILTER_REJECT;

                    // 如果父级或祖先节点已经处理过，或者属于输入框/脚本，直接拒绝
                    if (parent.hasAttribute('data-text-rewritten') || parent.closest('[data-text-rewritten]')) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const tag=parent.tagName.toLowerCase();
                    if(['script','style','textarea','input'].includes(tag) || parent.isContentEditable || parent.closest('#text-rewriter-ultra-root'))
                        return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }}
            );
            let node; while(node=walker.nextNode()){ this.processTextNode(node);}
        },

        start() {
            if (Config.isCurrentDomainDisabled()) return;

            const firstScan = () => { this.walk(document.body || document.documentElement); };
            if (document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', firstScan);}
            else firstScan();

            let timer=null;
            this.observer = new MutationObserver((mutations)=>{
                clearTimeout(timer);
                timer=setTimeout(()=>{
                    if(this.isProcessing) return;
                    this.isProcessing=true;
                    try {
                        for(const mutation of mutations){
                            // 忽略由脚本自己修改属性（Attribute）引起的变动，防止死循环
                            if(mutation.type==='attributes' && mutation.attributeName==='data-text-rewritten') continue;

                            if(mutation.type==='characterData'){
                                this.processTextNode(mutation.target);
                                continue;
                            }
                            if(mutation.type==='childList'){
                                for(const node of mutation.addedNodes){
                                    if(node.nodeType===Node.TEXT_NODE) this.processTextNode(node);
                                    else if(node.nodeType===Node.ELEMENT_NODE) this.walk(node);
                                }
                            }
                        }
                    } finally { this.isProcessing=false; }
                },50);
            });

            this.observer.observe(document.documentElement,{
                childList:true,
                subtree:true,
                characterData:true,
                attributes: true, // 额外监控属性，用来精确过滤
                attributeFilter: ['data-text-rewritten']
            });

            setInterval(()=>{ this.walk(document.body || document.documentElement); }, 2000);
        },

        stop(){ if(this.observer){ this.observer.disconnect(); this.observer=null; } },
        restart(){ this.stop(); this.start(); }
    };

    // ==========================================
    // 3. UI 控制中心（极致贴边小球 + Shadow DOM 隔离面板）
    // ==========================================
    const UI = {
        root: null,
        shadow: null,

        init() {
            this.root = document.createElement('div');
            this.root.id = 'text-rewriter-ultra-root';
            // 固定定位在右侧
            this.root.style.cssText = 'position:fixed; top:140px; right:0; z-index:2147483647; font-family: system-ui, -apple-system, sans-serif;';
            document.documentElement.appendChild(this.root);

            this.shadow = this.root.attachShadow({ mode: 'closed' });

            this.shadow.innerHTML = `
                <style>
                    /* 交互区域包裹壳 */
                    .wrapper {
                        position: relative;
                        display: flex;
                        justify-content: flex-end;
                        align-items: flex-start;
                    }

                    /* 极致隐藏小球：平时向右缩进一半，且高透明度 */
                    .trigger-ball {
                        width: 34px; height: 34px; background: #4F46E5; color: white;
                        border-radius: 50% 0 0 50%; display: flex; align-items: center; justify-content: center;
                        cursor: pointer; box-shadow: -2px 2px 8px rgba(0,0,0,0.15); font-size: 14px;
                        user-select: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        transform: translateX(17px); opacity: 0.25;
                    }

                    /* 鼠标悬停到右侧边缘时，小球吐出并变清晰 */
                    .wrapper:hover .trigger-ball {
                        transform: translateX(0); opacity: 1;
                        box-shadow: -4px 4px 12px rgba(79, 70, 229, 0.4);
                    }

                    /* 设置面板主体（默认隐藏，点击打开） */
                    .main-panel {
                        display: none; width: 350px; max-height: 490px; background: white;
                        box-shadow: -4px 4px 24px rgba(0,0,0,0.15); border-radius: 10px 0 0 10px;
                        flex-direction: column; overflow: hidden; border: 1px solid #E5E7EB; border-right: none;
                        animation: slideIn 0.2s ease-out;
                    }

                    @keyframes slideIn {
                        from { transform: translateX(40px); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }

                    .header { background: #4F46E5; color: white; padding: 10px 14px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
                    .header .close-panel-btn { cursor: pointer; font-size: 18px; padding: 0 4px; user-select: none; transition: color 0.2s; }
                    .header .close-panel-btn:hover { color: #FECACA; }

                    .content { padding: 14px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; font-size: 12px; color: #374151; box-sizing: border-box;}

                    /* 当前网站状态栏 */
                    .status-bar { display: flex; justify-content: space-between; align-items: center; background: #F3F4F6; padding: 6px 10px; border-radius: 6px; }
                    .btn-action { background: #E5E7EB; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }
                    .btn-action.active { background: #EF4444; color: white; }

                    /* 规则滚动展示区 */
                    .rules-list { max-height: 160px; overflow-y: auto; border: 1px solid #E5E7EB; border-radius: 6px; padding: 6px; display: flex; flex-direction: column; gap: 6px; background: #FFF; }
                    .rule-item { display: flex; align-items: center; justify-content: space-between; background: #F9FAFB; padding: 6px; border-radius: 4px; border: 1px solid #F3F4F6; }
                    .rule-info { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 210px; }
                    .rule-info strong { color: #2563EB; }
                    .badge { font-size: 9px; padding: 1px 3px; border-radius: 3px; margin-right: 4px; background: #E5E7EB; }
                    .badge.regex { background: #DBEAFE; color: #1E40AF; }

                    /* 交互表单 */
                    .form-group { display: flex; flex-direction: column; gap: 6px; background: #F9FAFB; padding: 10px; border-radius: 6px; border: 1px solid #E5E7EB; box-sizing: border-box;}
                    .input-row { display: flex; gap: 6px; }
                    input, select { flex: 1; padding: 5px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 11px; outline: none; background: #FFF; color:#000; min-width: 0; }
                    input:focus { border-color: #4F46E5; }
                    .btn-submit { background: #4F46E5; color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; }

                    .footer-io { display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid #E5E7EB; margin-top: 4px; }
                </style>

                <div class="wrapper">
                    <div id="trigger-ball" class="trigger-ball" title="点击打开文本替换配置">📝</div>

                    <div id="main-panel" class="main-panel">
                        <div class="header">
                            <span>📝 文本替换配置中心 v1.4.0</span>
                            <span id="close-panel" class="close-panel-btn" title="关闭隐藏">&times;</span>
                        </div>
                        <div class="content">
                            <div class="status-bar">
                                <span>当前网站黑名单状态:</span>
                                <button id="btn-toggle-domain" class="btn-action">加载中...</button>
                            </div>

                            <div>
                                <div style="font-weight: bold; margin-bottom: 4px;">当前替换规则链 (实时生效):</div>
                                <div class="rules-list" id="rules-container"></div>
                            </div>

                            <div class="form-group">
                                <div style="font-weight: bold; font-size:11px; color:#4F46E5;">➕ 添加新规则</div>
                                <div class="input-row">
                                    <select id="input-mode">
                                        <option value="text">纯文本模式</option>
                                        <option value="regex">正则表达式</option>
                                    </select>
                                    <input type="text" id="input-from" placeholder="要查找的词...">
                                </div>
                                <div class="input-row">
                                    <input type="text" id="input-to" placeholder="替换成什么...">
                                    <button class="btn-submit" id="btn-add-rule">添加</button>
                                </div>
                            </div>

                            <div class="footer-io">
                                <button class="btn-action" id="btn-export">导出 JSON</button>
                                <button class="btn-action" id="btn-import">导入 JSON</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.bindEvents();
            this.render();
        },

        bindEvents() {
            const ball = this.shadow.getElementById('trigger-ball');
            const panel = this.shadow.getElementById('main-panel');
            const closeBtn = this.shadow.getElementById('close-panel');
            const btnToggleDomain = this.shadow.getElementById('btn-toggle-domain');
            const btnAddRule = this.shadow.getElementById('btn-add-rule');
            const btnExport = this.shadow.getElementById('btn-export');
            const btnImport = this.shadow.getElementById('btn-import');

            // 核心交互：点击小球 ➔ 隐藏小球，滑出配置面板
            ball.addEventListener('click', () => {
                ball.style.display = 'none';
                panel.style.display = 'flex';
            });

            // 核心交互：点击关闭 ➔ 隐藏面板，还原边缘小球
            closeBtn.addEventListener('click', () => {
                panel.style.display = 'none';
                ball.style.display = 'flex';
            });

            // 当前网域加白/加黑
            btnToggleDomain.addEventListener('click', () => {
                Config.toggleCurrentDomain();
                this.render();
                if (Config.isCurrentDomainDisabled()) {
                    Engine.stop();
                    alert("已对当前域名禁用文本替换。");
                } else {
                    Engine.restart();
                }
            });

            // 增加新替换词
            btnAddRule.addEventListener('click', () => {
                const mode = this.shadow.getElementById('input-mode').value;
                const from = this.shadow.getElementById('input-from').value;
                const to = this.shadow.getElementById('input-to').value;

                if (!from) return alert('查找目标不能为空！');

                Config.data.rules.push({
                    id: Date.now().toString(),
                    mode,
                    from,
                    to,
                    enabled: true
                });

                Config.save();
                this.render();
                Engine.restart();

                this.shadow.getElementById('input-from').value = '';
                this.shadow.getElementById('input-to').value = '';
            });

            // 规则的管理（事件委托）
            this.shadow.getElementById('rules-container').addEventListener('click', (e) => {
                const target = e.target;
                const id = target.getAttribute('data-id');
                if (!id) return;

                if (target.classList.contains('btn-del')) {
                    Config.data.rules = Config.data.rules.filter(r => r.id !== id);
                } else if (target.classList.contains('btn-toggle-rule')) {
                    const rule = Config.data.rules.find(r => r.id === id);
                    if (rule) rule.enabled = !rule.enabled;
                }

                Config.save();
                this.render();
                Engine.restart();
            });

            // 数据导出
            btnExport.addEventListener('click', () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(Config.data.rules, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", "text_rewriter_rules.json");
                downloadAnchor.click();
            });

            // 数据导入
            btnImport.addEventListener('click', () => {
                const jsonStr = prompt("请粘贴导出的 JSON 规则：");
                if (!jsonStr) return;
                try {
                    const parsed = JSON.parse(jsonStr);
                    if (Array.isArray(parsed)) {
                        Config.data.rules = parsed;
                        Config.save();
                        this.render();
                        Engine.restart();
                        alert("规则导入并应用成功！");
                    } else {
                        alert("数据有误，必须是标准的数组结构。");
                    }
                } catch (e) {
                    alert("解析失败，请检查粘贴的数据格式。");
                }
            });
        },

        render() {
            // 同步黑名单开关状态
            const btnToggleDomain = this.shadow.getElementById('btn-toggle-domain');
            if (Config.isCurrentDomainDisabled()) {
                btnToggleDomain.textContent = '❌ 当前网站已禁用';
                btnToggleDomain.classList.add('active');
            } else {
                btnToggleDomain.textContent = '🟢 当前网站已启用';
                btnToggleDomain.classList.remove('active');
            }

            // 同步渲染规则链
            const container = this.shadow.getElementById('rules-container');
            if (Config.data.rules.length === 0) {
                container.innerHTML = `<div style="color: #9CA3AF; text-align: center; padding: 10px; font-size:11px;">暂无任何规则，请在下方添加</div>`;
                return;
            }

            container.innerHTML = Config.data.rules.map(rule => `
                <div class="rule-item" style="${!rule.enabled ? 'opacity: 0.4;' : ''}">
                    <div class="rule-info">
                        <span class="badge ${rule.mode}">${rule.mode === 'regex' ? '正则' : '文本'}</span>
                        <span>${escapeHtml(rule.from)}</span> ➔ <strong>${escapeHtml(rule.to)}</strong>
                    </div>
                    <div style="display:flex; gap: 4px;">
                        <button class="btn-action btn-toggle-rule" data-id="${rule.id}">${rule.enabled ? '停用' : '启用'}</button>
                        <button class="btn-action btn-del" data-id="${rule.id}" style="background:#FEE2E2; color:#DC2626;">删</button>
                    </div>
                </div>
            `).join('');
        }
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // ==========================================
    // 4. 初始化启动入口
    // ==========================================
    const Boot = () => {
        Config.load();

        // 挂载 UI 面板
        if (document.body) {
            UI.init();
        } else {
            document.addEventListener('DOMContentLoaded', () => UI.init());
        }

        // 启动高性能监听替换引擎
        Engine.start();
    };

    Boot();
})();
