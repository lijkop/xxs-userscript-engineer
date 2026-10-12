// ==UserScript==
// @name         多引擎批量搜索
// @name:en      Multi-Engine Batch Search
// @namespace    https://tampermonkey.net/
// @version      2.1.2
// @description  批量在多个搜索引擎同时打开当前关键词，支持引擎分组、快捷键录制、油猴菜单、悬浮按钮、拖拽排序与配置导入导出。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:zh-CN 批量在多个搜索引擎同时打开当前关键词，支持引擎分组、快捷键录制、油猴菜单、悬浮按钮、拖拽排序与配置导入导出。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:en Open the current query across multiple search engines at once: engine groups, hotkey recording, menu commands, floating button, drag sorting, import/export. Feedback via Telegram: https://t.me/zzyyffxx
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/multi-engine-search.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/multi-engine-search.user.js
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // 默认搜索引擎
    // ============================================================

    const DEFAULT_GROUPS = [
        {
            name: "搜索引擎",
            engines: [
                { name: "Google", url: "https://www.google.com/search?q={q}" },
                { name: "Bing", url: "https://www.bing.com/search?q={q}" },
                { name: "百度", url: "https://www.baidu.com/s?wd={q}" },
                { name: "搜狗", url: "https://www.sogou.com/web?query={q}" },
                { name: "DuckDuckGo", url: "https://duckduckgo.com/?q={q}" },
                { name: "Startpage", url: "https://www.startpage.com/sp/search?query={q}" },
                { name: "Ecosia", url: "https://www.ecosia.org/search?q={q}" },
                { name: "Yandex", url: "https://yandex.com/search/?text={q}" }
            ]
        },

        {
            name: "常用",
            engines: [
                { name: "知乎", url: "https://www.zhihu.com/search?q={q}" },
                { name: "Bilibili", url: "https://search.bilibili.com/all?keyword={q}" },
                { name: "YouTube", url: "https://www.youtube.com/results?search_query={q}" },
                { name: "抖音", url: "https://www.douyin.com/search/{q}" },
                { name: "小红书", url: "https://www.xiaohongshu.com/search_result?keyword={q}&type=51" },
                { name: "GitHub", url: "https://github.com/search?q={q}" },
                { name: "X / Twitter", url: "https://x.com/search?q={q}" },
                { name: "微博", url: "https://s.weibo.com/weibo?q={q}" },
                { name: "豆瓣", url: "https://www.douban.com/search?q={q}" },
                { name: "什么值得买", url: "https://search.smzdm.com/?c=home&s={q}" }
            ]
        },

        {
            name: "论坛",
            engines: [
                { name: "百度贴吧", url: "https://tieba.baidu.com/f/search/res?qw={q}" },
                { name: "Linux.do", url: "https://www.google.com/search?q=site%3Alinux.do+{q}" },
                { name: "V2EX", url: "https://www.google.com/search?q=site%3Av2ex.com+{q}" },
                { name: "NGA", url: "https://www.google.com/search?q=site%3Anga.cn+{q}" },
                { name: "Reddit", url: "https://www.reddit.com/search/?q={q}" },
                { name: "小众软件论坛", url: "https://www.google.com/search?q=site%3Ameta.appinn.net+{q}" }
            ]
        },

        {
            name: "TG",
            engines: [
                { name: "Telegram 官方", url: "https://www.google.com/search?q=site%3At.me+{q}" },
                { name: "TGStat", url: "https://www.google.com/search?q=site%3Atgstat.com+{q}" },
                { name: "Telemetr", url: "https://www.google.com/search?q=site%3Atelemetr.io+{q}" },
                { name: "Telegraph", url: "https://www.google.com/search?q=site%3Atelegra.ph+{q}" },
                { name: "TeleTop", url: "https://en.teletop.org/search?utf8=✓&q[name_cont]={q}" }
            ]
        },

        {
            name: "网盘",
            engines: [
                { name: "千帆搜索", url: "https://tg.qianfan.app/search/?q={q}" },
                { name: "FastSoso", url: "https://www.fastsoso.cc/search?k={q}" },
                { name: "易搜", url: "https://yiso.fun/info?searchKey={q}" },
                { name: "PanOther", url: "https://panothers.com/search?keyword={q}" },
                { name: "阿里盘搜", url: "https://www.alipansou.com/search?k={q}" },
                { name: "PanSearch", url: "https://www.pansearch.me/search?keyword={q}" },
                { name: "Magic Search", url: "https://www.magicalsearch.top/search?word={q}" },
                { name: "UP云搜", url: "https://www.upyunso.com/search.html?page=1&keyword={q}" },
                { name: "云搜", url: "https://www.yunso.net/index/user/s?wd={q}" },
                { name: "NiceSo", url: "https://www.niceso.net/search/?q={q}" },
                { name: "搜搜盘", url: "https://sousou.pro/search?exact=false&page=1&q={q}" },
                { name: "皮卡搜索", url: "https://www.pikaso.top/search/?pan=all&q={q}" },
                { name: "快盘搜", url: "https://www.kpanso.com/search?exact=false&page=1&q={q}" },
                { name: "盘基地", url: "https://www.google.com/search?q=site%3Apanjd.top+{q}" }
            ]
        },

        {
            name: "软件",
            engines: [
                { name: "六音", url: "https://www.sixyin.com/?s={q}" },
                { name: "易破解", url: "https://www.ypojie.com/?s={q}" },
                { name: "YXSSP", url: "https://www.yxssp.com/?s={q}" },
                { name: "大眼仔", url: "https://www.dayanzai.me/?s={q}" },
                { name: "果核剥壳", url: "https://www.ghxi.com/?s={q}" },
                { name: "423Down", url: "https://www.423down.com/?s={q}" },
                { name: "分享迷", url: "https://www.fenxm.com/search.php?q={q}" },
                { name: "B站专栏", url: "https://search.bilibili.com/article?keyword={q}" }
            ]
        },

        {
            name: "知识",
            engines: [
                { name: "Wikipedia", url: "https://zh.wikipedia.org/w/index.php?search={q}" },
                { name: "百度文库", url: "https://wenku.baidu.com/search?word={q}" },
                { name: "萌娘百科", url: "https://zh.moegirl.org.cn/index.php?search={q}" },
                { name: "Quora", url: "https://www.quora.com/search?q={q}" },
                { name: "Stack Overflow", url: "https://stackoverflow.com/search?q={q}" }
            ]
        },

        {
            name: "站内搜索",
            engines: [
                { name: "飞书", url: "https://www.google.com/search?q=site%3Afeishu.cn+{q}" },
                { name: "腾讯文档", url: "https://www.google.com/search?q=site%3Adocs.qq.com+{q}" },
                { name: "Notion", url: "https://www.google.com/search?q=site%3Anotion.site+{q}" },
                { name: "GitBook", url: "https://www.google.com/search?q=site%3Agitbook.io+{q}" },
                { name: "Instagram", url: "https://www.google.com/search?q=site%3Ainstagram.com+{q}" },
                { name: "少数派", url: "https://www.google.com/search?q=site%3Asspai.com+{q}" }
            ]
        }
    ];

    // ============================================================
    // 配置
    // ============================================================

    const STORAGE_KEY = "MY_MULTI_SEARCH_V2_CONFIG";
    const CONFIG_VERSION = 2;

    function createId(prefix = "id") {
        return (
            prefix +
            "_" +
            Date.now().toString(36) +
            "_" +
            Math.random().toString(36).slice(2, 9)
        );
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function makeDefaultConfig() {
        const groups = deepClone(DEFAULT_GROUPS);

        groups.forEach(group => {
            group.id = createId("group");

            group.engines.forEach(engine => {
                engine.id = createId("engine");
            });
        });

        const selectedIds = [];

        groups.forEach(group => {
            group.engines.forEach(engine => {
                if (
                    engine.name === "Google" ||
                    engine.name === "Bing" ||
                    engine.name === "百度"
                ) {
                    selectedIds.push(engine.id);
                }
            });
        });

        return {
            version: CONFIG_VERSION,

            groups,

            selectedIds,

            hotkey: {
                ctrl: true,
                alt: false,
                shift: true,
                key: "K",
                code: "KeyK"
            },

            showFloatButton: true
        };
    }

    function sanitizeConfig(raw) {
        if (!raw || typeof raw !== "object") {
            return makeDefaultConfig();
        }

        const result = {
            version: CONFIG_VERSION,
            groups: [],
            selectedIds: [],
            hotkey: {
                ctrl: true,
                alt: false,
                shift: true,
                key: "K",
                code: "KeyK"
            },
            showFloatButton: true
        };

        if (Array.isArray(raw.groups)) {
            raw.groups.forEach(rawGroup => {
                if (!rawGroup || typeof rawGroup !== "object") return;

                const group = {
                    id:
                        typeof rawGroup.id === "string"
                            ? rawGroup.id
                            : createId("group"),

                    name:
                        typeof rawGroup.name === "string" &&
                        rawGroup.name.trim()
                            ? rawGroup.name.trim()
                            : "未命名分类",

                    engines: []
                };

                if (Array.isArray(rawGroup.engines)) {
                    rawGroup.engines.forEach(rawEngine => {
                        if (!rawEngine || typeof rawEngine !== "object") return;

                        if (
                            typeof rawEngine.name !== "string" ||
                            typeof rawEngine.url !== "string"
                        ) {
                            return;
                        }

                        group.engines.push({
                            id:
                                typeof rawEngine.id === "string"
                                    ? rawEngine.id
                                    : createId("engine"),

                            name: rawEngine.name.trim() || "未命名",

                            url: rawEngine.url.trim()
                        });
                    });
                }

                result.groups.push(group);
            });
        }

        if (!result.groups.length) {
            return makeDefaultConfig();
        }

        const validEngineIds = new Set();

        result.groups.forEach(group => {
            group.engines.forEach(engine => {
                validEngineIds.add(engine.id);
            });
        });

        if (Array.isArray(raw.selectedIds)) {
            result.selectedIds = raw.selectedIds.filter(id =>
                validEngineIds.has(id)
            );
        }

        if (raw.hotkey && typeof raw.hotkey === "object") {
            result.hotkey = {
                ctrl: !!raw.hotkey.ctrl,
                alt: !!raw.hotkey.alt,
                shift: !!raw.hotkey.shift,

                key:
                    typeof raw.hotkey.key === "string"
                        ? raw.hotkey.key
                        : "K",

                code:
                    typeof raw.hotkey.code === "string"
                        ? raw.hotkey.code
                        : "KeyK"
            };
        }

        if (typeof raw.showFloatButton === "boolean") {
            result.showFloatButton = raw.showFloatButton;
        }

        return result;
    }

    function loadConfig() {
        try {
            const saved = GM_getValue(STORAGE_KEY, null);

            if (saved) {
                return sanitizeConfig(saved);
            }
        } catch (error) {
            console.warn("[多引擎搜索] 读取配置失败", error);
        }

        return makeDefaultConfig();
    }

    function saveConfig() {
        try {
            GM_setValue(
                STORAGE_KEY,
                deepClone(config)
            );
        } catch (error) {
            console.warn("[多引擎搜索] 保存配置失败", error);
        }
    }

    let config = loadConfig();

    let currentGroupId =
        config.groups[0]?.id || null;

    let settingsOpen = false;

    let editingEngineId = null;

    let recordingHotkey = false;

    // ============================================================
    // 工具
    // ============================================================

    function findGroup(groupId) {
        return config.groups.find(
            group => group.id === groupId
        );
    }

    function findEngine(engineId) {
        for (const group of config.groups) {
            const engine =
                group.engines.find(
                    item => item.id === engineId
                );

            if (engine) {
                return {
                    group,
                    engine
                };
            }
        }

        return null;
    }

    function buildSearchURL(template, keyword) {
        const encoded =
            encodeURIComponent(keyword.trim());

        return template
            .replaceAll("{q}", encoded)
            .replaceAll("%s", encoded);
    }

    function openTab(url, active = false) {
        try {
            GM_openInTab(
                url,
                {
                    active,
                    insert: true,
                    setParent: true
                }
            );
        } catch (error) {
            window.open(
                url,
                "_blank",
                "noopener,noreferrer"
            );
        }
    }

    function hotkeyText(hotkey) {
        const parts = [];

        if (hotkey.ctrl) parts.push("Ctrl");
        if (hotkey.alt) parts.push("Alt");
        if (hotkey.shift) parts.push("Shift");

        parts.push(
            hotkey.key || "K"
        );

        return parts.join(" + ");
    }

    function isHotkeyMatch(event) {
        const hotkey = config.hotkey;

        if (!hotkey) return false;

        const modifierMatch =
            event.ctrlKey === !!hotkey.ctrl &&
            event.altKey === !!hotkey.alt &&
            event.shiftKey === !!hotkey.shift;

        if (!modifierMatch) return false;

        if (
            hotkey.code &&
            event.code === hotkey.code
        ) {
            return true;
        }

        return (
            String(event.key).toUpperCase() ===
            String(hotkey.key).toUpperCase()
        );
    }

    // ============================================================
    // 拖拽排序工具
    // ============================================================

    let dragData = null;

    function initDragSort(container, groupId, isManage = false) {
        let items = container.querySelectorAll('.msv2-engine, .msv2-manage-engine');

        items.forEach(item => {
            // 为管理列表中的行添加拖拽手柄标识
            if (isManage) {
                // 在管理列表中添加拖拽手柄
                if (!item.querySelector('.msv2-drag-handle')) {
                    const handle = document.createElement('span');
                    handle.className = 'msv2-drag-handle';
                    handle.textContent = '⠿';
                    handle.style.cssText = `
                        cursor: grab;
                        color: #9ca3af;
                        font-size: 18px;
                        user-select: none;
                        margin-right: 4px;
                    `;
                    handle.title = '拖动排序';
                    item.prepend(handle);
                }
            }

            item.setAttribute('draggable', 'true');

            item.addEventListener('dragstart', (e) => {
                const engineId = item.dataset.engineId;
                if (!engineId) return;
                
                dragData = {
                    engineId: engineId,
                    groupId: groupId,
                    isManage: isManage
                };
                
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', engineId);
                
                // 添加拖拽样式
                setTimeout(() => {
                    item.style.opacity = '0.5';
                }, 0);
            });

            item.addEventListener('dragend', (e) => {
                item.style.opacity = '1';
                // 清除所有拖拽高亮
                container.querySelectorAll('.msv2-drag-over').forEach(el => {
                    el.classList.remove('msv2-drag-over');
                });
                dragData = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // 高亮目标
                container.querySelectorAll('.msv2-drag-over').forEach(el => {
                    el.classList.remove('msv2-drag-over');
                });
                item.classList.add('msv2-drag-over');
            });

            item.addEventListener('dragleave', (e) => {
                item.classList.remove('msv2-drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('msv2-drag-over');
                
                if (!dragData) return;
                if (dragData.groupId !== groupId) return;
                
                const sourceId = dragData.engineId;
                const targetId = item.dataset.engineId;
                
                if (sourceId === targetId) return;
                
                // 执行排序
                const group = findGroup(groupId);
                if (!group) return;
                
                const engines = group.engines;
                const sourceIndex = engines.findIndex(e => e.id === sourceId);
                const targetIndex = engines.findIndex(e => e.id === targetId);
                
                if (sourceIndex === -1 || targetIndex === -1) return;
                
                // 移动元素
                const [removed] = engines.splice(sourceIndex, 1);
                engines.splice(targetIndex, 0, removed);
                
                saveConfig();
                
                // 重新渲染
                if (isManage) {
                    renderManageEngineList();
                } else {
                    renderEngines();
                }
                
                // 重新初始化拖拽
                setTimeout(() => {
                    if (isManage) {
                        initDragSort(manageEngineList, groupId, true);
                    } else {
                        initDragSort(enginesContainer, currentGroupId, false);
                    }
                }, 50);
            });
        });
    }

    // ============================================================
    // CSS
    // ============================================================

    const style =
        document.createElement("style");

    style.textContent = `

        #multiSearchRootV2,
        #multiSearchRootV2 * {
            box-sizing: border-box;
        }

        #multiSearchRootV2 {
            position: fixed;
            right: 22px;
            bottom: 22px;

            z-index: 2147483647;

            font-family:
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                "Microsoft YaHei",
                sans-serif;

            font-size: 14px;
            line-height: 1.4;

            color: #111827;
        }

        #msFloatButtonV2 {
            width: 54px;
            height: 54px;

            border: none;
            border-radius: 50%;

            background: #111827;
            color: #fff;

            font-size: 25px;

            cursor: pointer;

            box-shadow:
                0 8px 30px rgba(0,0,0,.30);
        }

        #msFloatButtonV2:hover {
            transform: translateY(-1px);
            background: #1f2937;
        }

        #msPanelV2 {
            display: none;

            position: absolute;

            right: 0;
            bottom: 66px;

            width:
                min(
                    900px,
                    calc(100vw - 32px)
                );

            max-height:
                min(
                    760px,
                    calc(100vh - 100px)
                );

            overflow: hidden;

            background: #fff;

            border:
                1px solid #d1d5db;

            border-radius: 16px;

            box-shadow:
                0 20px 70px rgba(0,0,0,.30);
        }

        #msPanelV2.show {
            display: block;
        }

        .msv2-header {
            padding: 14px;

            border-bottom:
                1px solid #e5e7eb;
        }

        .msv2-search-row {
            display: flex;

            align-items: center;

            gap: 8px;
        }

        #msKeywordV2 {
            flex: 1;

            min-width: 0;

            height: 42px;

            padding:
                0 12px;

            border:
                1px solid #cbd5e1;

            border-radius: 10px;

            outline: none;

            font-size: 16px;

            background: #fff;
            color: #111827;
        }

        #msKeywordV2:focus {
            border-color: #64748b;

            box-shadow:
                0 0 0 3px rgba(100,116,139,.12);
        }

        .msv2-btn {
            min-height: 38px;

            padding:
                7px 12px;

            border:
                1px solid #cbd5e1;

            border-radius: 9px;

            background: #fff;

            color: #111827;

            cursor: pointer;

            white-space: nowrap;
        }

        .msv2-btn:hover {
            background: #f3f4f6;
        }

        .msv2-primary {
            background: #111827;
            color: #fff;
            border-color: #111827;
        }

        .msv2-primary:hover {
            background: #1f2937;
        }

        .msv2-danger {
            color: #b91c1c;
        }

        .msv2-search-view {
            display: grid;

            grid-template-columns:
                150px 1fr;

            min-height: 390px;

            max-height:
                calc(100vh - 220px);
        }

        .msv2-groups {
            padding: 10px;

            overflow-y: auto;

            border-right:
                1px solid #e5e7eb;

            background: #fafafa;
        }

        .msv2-group {
            display: block;

            width: 100%;

            margin-bottom: 4px;

            padding:
                9px 10px;

            border: none;

            border-radius: 8px;

            background: transparent;

            color: #111827;

            text-align: left;

            cursor: pointer;
        }

        .msv2-group:hover {
            background: #f3f4f6;
        }

        .msv2-group.active {
            background: #e5e7eb;
            font-weight: 700;
        }

        .msv2-content {
            padding: 12px;

            overflow-y: auto;
        }

        .msv2-toolbar {
            display: flex;

            align-items: center;

            flex-wrap: wrap;

            gap: 8px;

            margin-bottom: 12px;
        }

        .msv2-status {
            margin-left: auto;

            color: #64748b;

            font-size: 12px;
        }

        .msv2-engine-grid {
            display: grid;

            grid-template-columns:
                repeat(
                    auto-fill,
                    minmax(180px,1fr)
                );

            gap: 8px;
        }

        .msv2-engine {
            display: flex;

            align-items: center;

            gap: 8px;

            min-height: 44px;

            padding:
                6px 9px;

            border:
                1px solid #e5e7eb;

            border-radius: 9px;

            background: #fff;

            cursor: grab;
            user-select: none;
            transition: background 0.15s;
        }

        .msv2-engine:hover {
            background: #f9fafb;
        }

        .msv2-engine.dragging {
            opacity: 0.5;
        }

        .msv2-engine.msv2-drag-over {
            border-color: #111827;
            background: #f3f4f6;
            box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.1);
        }

        .msv2-engine-name {
            flex: 1;

            overflow: hidden;

            white-space: nowrap;

            text-overflow: ellipsis;

            cursor: pointer;
        }

        .msv2-engine-open {
            border: 0;

            background: transparent;

            font-size: 17px;

            cursor: pointer;
        }

        .msv2-footer {
            display: flex;

            justify-content: space-between;

            gap: 10px;

            padding:
                9px 14px;

            border-top:
                1px solid #e5e7eb;

            color: #64748b;

            font-size: 12px;
        }

        /* 设置 */

        #msSettingsV2 {
            display: none;

            max-height:
                calc(100vh - 180px);

            overflow-y: auto;

            padding: 16px;
        }

        #msSettingsV2.show {
            display: block;
        }

        .msv2-setting-section {
            margin-bottom: 22px;

            padding-bottom: 18px;

            border-bottom:
                1px solid #e5e7eb;
        }

        .msv2-setting-title {
            margin-bottom: 12px;

            font-size: 16px;

            font-weight: 700;
        }

        .msv2-setting-row {
            display: flex;

            align-items: center;

            gap: 8px;

            flex-wrap: wrap;

            margin-bottom: 10px;
        }

        .msv2-input,
        .msv2-select {
            min-height: 38px;

            padding:
                7px 10px;

            border:
                1px solid #cbd5e1;

            border-radius: 8px;

            background: #fff;

            color: #111827;

            outline: none;
        }

        .msv2-input {
            flex: 1;

            min-width: 180px;
        }

        .msv2-url-input {
            width: 100%;
        }

        .msv2-manage-list {
            margin-top: 12px;

            border:
                1px solid #e5e7eb;

            border-radius: 10px;

            overflow: hidden;
        }

        .msv2-manage-engine {
            display: grid;

            grid-template-columns:
                auto
                minmax(100px,160px)
                minmax(180px,1fr)
                auto;

            align-items: center;

            gap: 10px;

            padding: 10px;

            border-bottom:
                1px solid #e5e7eb;

            cursor: grab;
            user-select: none;
            transition: background 0.15s;
        }

        .msv2-manage-engine:last-child {
            border-bottom: none;
        }

        .msv2-manage-engine.msv2-drag-over {
            border-color: #111827;
            background: #f3f4f6;
            box-shadow: inset 0 0 0 2px rgba(17, 24, 39, 0.1);
        }

        .msv2-drag-handle {
            cursor: grab;
            color: #9ca3af;
            font-size: 18px;
            user-select: none;
        }

        .msv2-drag-handle:hover {
            color: #4b5563;
        }

        .msv2-manage-name {
            font-weight: 600;
        }

        .msv2-manage-url {
            overflow: hidden;

            white-space: nowrap;

            text-overflow: ellipsis;

            color: #64748b;

            font-size: 12px;
        }

        .msv2-manage-actions {
            display: flex;

            gap: 5px;
        }

        .msv2-small-btn {
            padding:
                5px 8px;

            border:
                1px solid #d1d5db;

            border-radius: 7px;

            background: #fff;

            cursor: pointer;
        }

        .msv2-hotkey-box {
            display: inline-flex;

            align-items: center;

            justify-content: center;

            min-width: 190px;

            min-height: 44px;

            padding:
                8px 14px;

            border:
                2px dashed #cbd5e1;

            border-radius: 9px;

            cursor: pointer;

            font-weight: 600;

            background: #f8fafc;
        }

        .msv2-hotkey-box.recording {
            border-color: #111827;

            background: #f3f4f6;
        }

        .msv2-help {
            color: #64748b;

            font-size: 12px;
        }

        .msv2-hidden {
            display: none !important;
        }

        /* 拖拽排序提示 */
        .msv2-sort-hint {
            display: inline-block;
            margin-left: 8px;
            color: #9ca3af;
            font-size: 12px;
        }

        @media (max-width: 650px) {

            #multiSearchRootV2 {
                right: 10px;
                bottom: 10px;
            }

            #msPanelV2 {
                width:
                    calc(100vw - 20px);

                max-height:
                    calc(100vh - 90px);
            }

            .msv2-search-view {
                grid-template-columns:
                    110px 1fr;
            }

            .msv2-engine-grid {
                grid-template-columns:
                    1fr;
            }

            .msv2-search-row {
                flex-wrap: wrap;
            }

            #msKeywordV2 {
                flex-basis: 100%;
            }

            .msv2-manage-engine {
                grid-template-columns:
                    1fr;
            }

        }

    `;

    document.documentElement.appendChild(style);

    // ============================================================
    // HTML
    // ============================================================

    const root =
        document.createElement("div");

    root.id =
        "multiSearchRootV2";

    root.innerHTML = `

        <div id="msPanelV2">

            <div class="msv2-header">

                <div class="msv2-search-row">

                    <input
                        id="msKeywordV2"
                        type="text"
                        placeholder="输入关键词"
                        autocomplete="off"
                    >

                    <button
                        id="msBatchSearchV2"
                        class="msv2-btn msv2-primary"
                    >
                        批量搜索
                    </button>

                    <button
                        id="msSettingsToggleV2"
                        class="msv2-btn"
                    >
                        ⚙ 设置
                    </button>

                    <button
                        id="msCloseV2"
                        class="msv2-btn"
                    >
                        关闭
                    </button>

                </div>

            </div>


            <div id="msSearchViewV2"
                 class="msv2-search-view">

                <div
                    id="msGroupsV2"
                    class="msv2-groups"
                ></div>

                <div class="msv2-content">

                    <div class="msv2-toolbar">

                        <button
                            id="msSelectGroupV2"
                            class="msv2-btn"
                        >
                            全选本组
                        </button>

                        <button
                            id="msClearGroupV2"
                            class="msv2-btn"
                        >
                            清空本组
                        </button>

                        <button
                            id="msClearAllV2"
                            class="msv2-btn"
                        >
                            全部取消
                        </button>

                        <span
                            id="msStatusV2"
                            class="msv2-status"
                        ></span>

                    </div>

                    <div class="msv2-help" style="margin-bottom:8px;font-size:12px;color:#9ca3af;">
                        💡 拖拽搜索引擎卡片可调整顺序
                    </div>

                    <div
                        id="msEnginesV2"
                        class="msv2-engine-grid"
                    ></div>

                </div>

            </div>


            <div id="msSettingsV2">

                <div class="msv2-setting-section">

                    <div class="msv2-setting-title">
                        搜索引擎管理
                        <span class="msv2-sort-hint">(拖动 ⠿ 排序)</span>
                    </div>

                    <div class="msv2-setting-row">

                        <select
                            id="msManageGroupV2"
                            class="msv2-select"
                        ></select>

                        <button
                            id="msAddGroupV2"
                            class="msv2-btn"
                        >
                            + 添加分类
                        </button>

                        <button
                            id="msRenameGroupV2"
                            class="msv2-btn"
                        >
                            重命名分类
                        </button>

                        <button
                            id="msDeleteGroupV2"
                            class="msv2-btn msv2-danger"
                        >
                            删除分类
                        </button>

                    </div>


                    <div
                        id="msManageEngineListV2"
                        class="msv2-manage-list"
                    ></div>

                </div>


                <div class="msv2-setting-section">

                    <div class="msv2-setting-title">
                        添加 / 修改搜索引擎
                    </div>

                    <div class="msv2-setting-row">

                        <input
                            id="msEngineNameV2"
                            class="msv2-input"
                            type="text"
                            placeholder="名称，例如：千帆搜索"
                        >

                        <select
                            id="msEngineGroupV2"
                            class="msv2-select"
                        ></select>

                    </div>

                    <div class="msv2-setting-row">

                        <input
                            id="msEngineUrlV2"
                            class="msv2-input msv2-url-input"
                            type="text"
                            placeholder="搜索串，例如：https://example.com/search?q={q}"
                        >

                    </div>

                    <div class="msv2-setting-row">

                        <button
                            id="msSaveEngineV2"
                            class="msv2-btn msv2-primary"
                        >
                            + 添加搜索引擎
                        </button>

                        <button
                            id="msCancelEditEngineV2"
                            class="msv2-btn"
                            style="display:none"
                        >
                            取消修改
                        </button>

                    </div>

                    <div class="msv2-help">
                        搜索网址必须包含 {q} 或 %s，脚本会自动替换成搜索关键词。
                    </div>

                </div>


                <div class="msv2-setting-section">

                    <div class="msv2-setting-title">
                        快捷键
                    </div>

                    <div class="msv2-setting-row">

                        <div
                            id="msHotkeyRecorderV2"
                            class="msv2-hotkey-box"
                            tabindex="0"
                        >
                        </div>

                    </div>

                    <div class="msv2-help">
                        点击上方区域，然后直接按新的组合键。至少需要 Ctrl / Alt / Shift 中的一个。
                    </div>

                </div>


                <div class="msv2-setting-section">

                    <div class="msv2-setting-title">
                        界面
                    </div>

                    <label class="msv2-setting-row">

                        <input
                            id="msShowFloatButtonV2"
                            type="checkbox"
                        >

                        页面右下角显示悬浮按钮

                    </label>

                    <div class="msv2-help">
                        即使关闭悬浮按钮，也可以通过快捷键或 Tampermonkey 菜单重新打开。
                    </div>

                </div>


                <div class="msv2-setting-section">

                    <div class="msv2-setting-title">
                        配置备份
                    </div>

                    <div class="msv2-setting-row">

                        <button
                            id="msExportConfigV2"
                            class="msv2-btn"
                        >
                            导出配置
                        </button>

                        <button
                            id="msImportConfigV2"
                            class="msv2-btn"
                        >
                            导入配置
                        </button>

                        <button
                            id="msResetConfigV2"
                            class="msv2-btn msv2-danger"
                        >
                            恢复默认
                        </button>

                    </div>

                    <input
                        id="msImportFileV2"
                        type="file"
                        accept=".json,application/json"
                        style="display:none"
                    >

                </div>

            </div>


            <div class="msv2-footer">

                <span>
                    ↗ = 单独搜索 | 拖拽排序
                </span>

                <span id="msHotkeyFooterV2">
                </span>

            </div>

        </div>


        <button
            id="msFloatButtonV2"
            title="打开多引擎搜索"
        >
            🔍
        </button>

    `;

    document.body.appendChild(root);

    // ============================================================
    // DOM
    // ============================================================

    const panel =
        root.querySelector("#msPanelV2");

    const floatButton =
        root.querySelector("#msFloatButtonV2");

    const keywordInput =
        root.querySelector("#msKeywordV2");

    const searchView =
        root.querySelector("#msSearchViewV2");

    const settingsView =
        root.querySelector("#msSettingsV2");

    const settingsToggle =
        root.querySelector("#msSettingsToggleV2");

    const groupsContainer =
        root.querySelector("#msGroupsV2");

    const enginesContainer =
        root.querySelector("#msEnginesV2");

    const statusText =
        root.querySelector("#msStatusV2");

    const hotkeyFooter =
        root.querySelector("#msHotkeyFooterV2");

    const manageGroup =
        root.querySelector("#msManageGroupV2");

    const manageEngineList =
        root.querySelector("#msManageEngineListV2");

    const engineNameInput =
        root.querySelector("#msEngineNameV2");

    const engineUrlInput =
        root.querySelector("#msEngineUrlV2");

    const engineGroup =
        root.querySelector("#msEngineGroupV2");

    const saveEngineButton =
        root.querySelector("#msSaveEngineV2");

    const cancelEditEngineButton =
        root.querySelector("#msCancelEditEngineV2");

    const hotkeyRecorder =
        root.querySelector("#msHotkeyRecorderV2");

    const showFloatButtonInput =
        root.querySelector("#msShowFloatButtonV2");

    const importFileInput =
        root.querySelector("#msImportFileV2");

    // ============================================================
    // 面板
    // ============================================================

    function showPanel(openSettings = false) {
        panel.classList.add("show");

        if (openSettings) {
            setSettingsOpen(true);
        }

        try {
            const selectedText =
                String(
                    window.getSelection()
                ).trim();

            if (
                selectedText &&
                !keywordInput.value.trim()
            ) {
                keywordInput.value =
                    selectedText;
            }
        } catch (e) {}

        render();

        if (!settingsOpen) {
            setTimeout(() => {
                keywordInput.focus();
            }, 50);
        }
    }

    function hidePanel() {
        panel.classList.remove("show");

        recordingHotkey = false;
    }

    function togglePanel() {
        if (
            panel.classList.contains("show")
        ) {
            hidePanel();
        } else {
            showPanel(false);
        }
    }

    function setSettingsOpen(open) {
        settingsOpen = !!open;

        if (settingsOpen) {
            searchView.style.display = "none";
            settingsView.classList.add("show");

            settingsToggle.textContent =
                "← 返回搜索";
        } else {
            searchView.style.display = "grid";
            settingsView.classList.remove("show");

            settingsToggle.textContent =
                "⚙ 设置";

            recordingHotkey = false;
        }

        render();
    }

    // ============================================================
    // 搜索界面渲染
    // ============================================================

    function renderGroups() {
        groupsContainer.innerHTML = "";

        if (
            !findGroup(currentGroupId) &&
            config.groups.length
        ) {
            currentGroupId =
                config.groups[0].id;
        }

        config.groups.forEach(group => {
            const button =
                document.createElement("button");

            button.className =
                "msv2-group";

            if (
                group.id === currentGroupId
            ) {
                button.classList.add(
                    "active"
                );
            }

            button.textContent =
                `${group.name} (${group.engines.length})`;

            button.addEventListener(
                "click",
                () => {
                    currentGroupId =
                        group.id;

                    renderSearch();
                }
            );

            groupsContainer.appendChild(
                button
            );
        });
    }

    function renderEngines() {
        enginesContainer.innerHTML = "";

        const group =
            findGroup(currentGroupId);

        if (!group) return;

        const selectedSet =
            new Set(config.selectedIds);

        if (!group.engines.length) {
            const empty =
                document.createElement("div");

            empty.className =
                "msv2-help";

            empty.textContent =
                "这个分类还没有搜索引擎，可以在「设置」中添加。";

            enginesContainer.appendChild(
                empty
            );

            return;
        }

        group.engines.forEach(engine => {
            const item =
                document.createElement("div");

            item.className =
                "msv2-engine";

            item.dataset.engineId = engine.id;

            const checkbox =
                document.createElement("input");

            checkbox.type =
                "checkbox";

            checkbox.checked =
                selectedSet.has(engine.id);

            checkbox.addEventListener(
                "change",
                () => {
                    const set =
                        new Set(
                            config.selectedIds
                        );

                    if (checkbox.checked) {
                        set.add(engine.id);
                    } else {
                        set.delete(engine.id);
                    }

                    config.selectedIds =
                        [...set];

                    saveConfig();

                    updateStatus();
                }
            );

            const name =
                document.createElement("div");

            name.className =
                "msv2-engine-name";

            name.textContent =
                engine.name;

            name.title =
                engine.url;

            name.addEventListener(
                "click",
                () => {
                    checkbox.checked =
                        !checkbox.checked;

                    checkbox.dispatchEvent(
                        new Event("change")
                    );
                }
            );

            const openButton =
                document.createElement("button");

            openButton.className =
                "msv2-engine-open";

            openButton.textContent =
                "↗";

            openButton.title =
                "只用这个搜索";

            openButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    singleSearch(engine);
                }
            );

            // 拖拽手柄 - 用⠿图标
            const dragHandle =
                document.createElement("span");

            dragHandle.className =
                "msv2-drag-handle";

            dragHandle.textContent =
                "⠿";

            dragHandle.style.cssText = `
                cursor: grab;
                color: #9ca3af;
                font-size: 16px;
                user-select: none;
                margin-right: 2px;
            `;

            dragHandle.title = "拖动排序";

            // 重新组织：拖拽手柄 + checkbox + name + openButton
            item.appendChild(dragHandle);
            item.appendChild(checkbox);
            item.appendChild(name);
            item.appendChild(openButton);

            enginesContainer.appendChild(
                item
            );
        });

        // 初始化拖拽排序
        initDragSort(enginesContainer, currentGroupId, false);
    }

    function updateStatus() {
        let total = 0;

        config.groups.forEach(group => {
            total +=
                group.engines.length;
        });

        const validIds =
            new Set();

        config.groups.forEach(group => {
            group.engines.forEach(engine => {
                validIds.add(engine.id);
            });
        });

        config.selectedIds =
            config.selectedIds.filter(
                id => validIds.has(id)
            );

        statusText.textContent =
            `已选择 ${config.selectedIds.length} / ${total}`;
    }

    // ============================================================
    // 设置界面
    // ============================================================

    function renderGroupSelects() {
        const previousManage =
            manageGroup.value;

        const previousEngineGroup =
            engineGroup.value;

        manageGroup.innerHTML = "";
        engineGroup.innerHTML = "";

        config.groups.forEach(group => {
            const option1 =
                document.createElement("option");

            option1.value =
                group.id;

            option1.textContent =
                group.name;

            manageGroup.appendChild(
                option1
            );

            const option2 =
                document.createElement("option");

            option2.value =
                group.id;

            option2.textContent =
                group.name;

            engineGroup.appendChild(
                option2
            );
        });

        if (
            findGroup(previousManage)
        ) {
            manageGroup.value =
                previousManage;
        } else if (
            findGroup(currentGroupId)
        ) {
            manageGroup.value =
                currentGroupId;
        }

        if (
            findGroup(previousEngineGroup)
        ) {
            engineGroup.value =
                previousEngineGroup;
        } else if (
            findGroup(currentGroupId)
        ) {
            engineGroup.value =
                currentGroupId;
        }
    }

    function renderManageEngineList() {
        manageEngineList.innerHTML = "";

        const group =
            findGroup(manageGroup.value);

        if (!group) return;

        if (!group.engines.length) {
            const empty =
                document.createElement("div");

            empty.style.padding =
                "12px";

            empty.className =
                "msv2-help";

            empty.textContent =
                "这个分类暂无搜索引擎。";

            manageEngineList.appendChild(
                empty
            );

            return;
        }

        group.engines.forEach(engine => {
            const row =
                document.createElement("div");

            row.className =
                "msv2-manage-engine";

            row.dataset.engineId = engine.id;

            // 拖拽手柄会由 initDragSort 添加，但这里先创建好结构
            // 为了保持一致性，我们用 data 属性标记

            const name =
                document.createElement("div");

            name.className =
                "msv2-manage-name";

            name.textContent =
                engine.name;

            const url =
                document.createElement("div");

            url.className =
                "msv2-manage-url";

            url.textContent =
                engine.url;

            url.title =
                engine.url;

            const actions =
                document.createElement("div");

            actions.className =
                "msv2-manage-actions";

            const editButton =
                document.createElement("button");

            editButton.className =
                "msv2-small-btn";

            editButton.textContent =
                "修改";

            editButton.addEventListener(
                "click",
                () => {
                    startEditEngine(
                        engine.id
                    );
                }
            );

            const deleteButton =
                document.createElement("button");

            deleteButton.className =
                "msv2-small-btn msv2-danger";

            deleteButton.textContent =
                "删除";

            deleteButton.addEventListener(
                "click",
                () => {
                    deleteEngine(
                        engine.id
                    );
                }
            );

            actions.appendChild(
                editButton
            );

            actions.appendChild(
                deleteButton
            );

            // 拖拽手柄会在 initDragSort 中添加到最前面
            row.appendChild(name);
            row.appendChild(url);
            row.appendChild(actions);

            manageEngineList.appendChild(
                row
            );
        });

        // 初始化拖拽排序
        initDragSort(manageEngineList, manageGroup.value, true);
    }

    function renderHotkey() {
        if (recordingHotkey) {
            hotkeyRecorder.textContent =
                "请按新的快捷键…";

            hotkeyRecorder.classList.add(
                "recording"
            );
        } else {
            hotkeyRecorder.textContent =
                hotkeyText(
                    config.hotkey
                );

            hotkeyRecorder.classList.remove(
                "recording"
            );
        }

        hotkeyFooter.textContent =
            `${hotkeyText(config.hotkey)} 打开`;
    }

    function applyFloatButtonVisibility() {
        floatButton.style.display =
            config.showFloatButton
                ? ""
                : "none";
    }

    function renderSettings() {
        renderGroupSelects();
        renderManageEngineList();
        renderHotkey();

        showFloatButtonInput.checked =
            config.showFloatButton;
    }

    function renderSearch() {
        renderGroups();
        renderEngines();
        updateStatus();
    }

    function render() {
        renderSearch();
        renderSettings();
        applyFloatButtonVisibility();
    }

    // ============================================================
    // 搜索
    // ============================================================

    function getKeyword() {
        const keyword =
            keywordInput.value.trim();

        if (!keyword) {
            keywordInput.placeholder =
                "请先输入关键词";

            keywordInput.focus();

            return null;
        }

        return keyword;
    }

    function singleSearch(engine) {
        const keyword =
            getKeyword();

        if (!keyword) return;

        const url =
            buildSearchURL(
                engine.url,
                keyword
            );

        openTab(
            url,
            true
        );
    }

    function batchSearch() {
        const keyword =
            getKeyword();

        if (!keyword) return;

        const selected =
            new Set(
                config.selectedIds
            );

        const engines = [];

        config.groups.forEach(group => {
            group.engines.forEach(engine => {
                if (
                    selected.has(engine.id)
                ) {
                    engines.push(engine);
                }
            });
        });

        if (!engines.length) {
            alert(
                "请至少选择一个搜索引擎"
            );

            return;
        }

        engines.forEach(
            (engine, index) => {
                const url =
                    buildSearchURL(
                        engine.url,
                        keyword
                    );

                setTimeout(
                    () => {
                        openTab(
                            url,
                            index === 0
                        );
                    },

                    index * 120
                );
            }
        );
    }

    // ============================================================
    // 勾选
    // ============================================================

    function selectCurrentGroup() {
        const group =
            findGroup(currentGroupId);

        if (!group) return;

        const selected =
            new Set(
                config.selectedIds
            );

        group.engines.forEach(engine => {
            selected.add(
                engine.id
            );
        });

        config.selectedIds =
            [...selected];

        saveConfig();

        renderSearch();
    }

    function clearCurrentGroup() {
        const group =
            findGroup(currentGroupId);

        if (!group) return;

        const groupIds =
            new Set(
                group.engines.map(
                    engine => engine.id
                )
            );

        config.selectedIds =
            config.selectedIds.filter(
                id => !groupIds.has(id)
            );

        saveConfig();

        renderSearch();
    }

    function clearAll() {
        config.selectedIds = [];

        saveConfig();

        renderSearch();
    }

    // ============================================================
    // 分类管理
    // ============================================================

    function addGroup() {
        const name =
            prompt(
                "请输入新分类名称："
            );

        if (
            !name ||
            !name.trim()
        ) {
            return;
        }

        const group = {
            id: createId("group"),
            name: name.trim(),
            engines: []
        };

        config.groups.push(
            group
        );

        currentGroupId =
            group.id;

        saveConfig();

        render();

        manageGroup.value =
            group.id;

        engineGroup.value =
            group.id;

        renderManageEngineList();
    }

    function renameGroup() {
        const group =
            findGroup(
                manageGroup.value
            );

        if (!group) return;

        const name =
            prompt(
                "新的分类名称：",
                group.name
            );

        if (
            !name ||
            !name.trim()
        ) {
            return;
        }

        group.name =
            name.trim();

        saveConfig();

        render();
    }

    function deleteGroup() {
        const group =
            findGroup(
                manageGroup.value
            );

        if (!group) return;

        if (
            config.groups.length <= 1
        ) {
            alert(
                "至少需要保留一个分类。"
            );

            return;
        }

        if (
            !confirm(
                `确定删除分类“${group.name}”及其中 ${group.engines.length} 个搜索引擎吗？`
            )
        ) {
            return;
        }

        const removedEngineIds =
            new Set(
                group.engines.map(
                    engine => engine.id
                )
            );

        config.groups =
            config.groups.filter(
                item =>
                    item.id !== group.id
            );

        config.selectedIds =
            config.selectedIds.filter(
                id =>
                    !removedEngineIds.has(id)
            );

        if (
            currentGroupId ===
            group.id
        ) {
            currentGroupId =
                config.groups[0]?.id ||
                null;
        }

        saveConfig();

        cancelEditEngine();

        render();
    }

    // ============================================================
    // 搜索引擎管理
    // ============================================================

    function startEditEngine(engineId) {
        const found =
            findEngine(engineId);

        if (!found) return;

        editingEngineId =
            engineId;

        engineNameInput.value =
            found.engine.name;

        engineUrlInput.value =
            found.engine.url;

        engineGroup.value =
            found.group.id;

        saveEngineButton.textContent =
            "保存修改";

        cancelEditEngineButton.style.display =
            "";

        engineNameInput.focus();
    }

    function cancelEditEngine() {
        editingEngineId =
            null;

        engineNameInput.value =
            "";

        engineUrlInput.value =
            "";

        saveEngineButton.textContent =
            "+ 添加搜索引擎";

        cancelEditEngineButton.style.display =
            "none";
    }

    function validateEngineForm() {
        const name =
            engineNameInput.value.trim();

        const url =
            engineUrlInput.value.trim();

        const groupId =
            engineGroup.value;

        if (!name) {
            alert(
                "请输入搜索引擎名称。"
            );

            engineNameInput.focus();

            return null;
        }

        if (!url) {
            alert(
                "请输入搜索串。"
            );

            engineUrlInput.focus();

            return null;
        }

        if (
            !url.includes("{q}") &&
            !url.includes("%s")
        ) {
            alert(
                "搜索串必须包含 {q} 或 %s 作为关键词占位符。"
            );

            engineUrlInput.focus();

            return null;
        }

        if (
            !/^https?:\/\//i.test(url)
        ) {
            alert(
                "搜索串需要以 http:// 或 https:// 开头。"
            );

            engineUrlInput.focus();

            return null;
        }

        const group =
            findGroup(groupId);

        if (!group) {
            alert(
                "请选择有效分类。"
            );

            return null;
        }

        return {
            name,
            url,
            group
        };
    }

    function saveEngineFromForm() {
        const data =
            validateEngineForm();

        if (!data) return;

        if (editingEngineId) {
            const found =
                findEngine(
                    editingEngineId
                );

            if (!found) {
                cancelEditEngine();

                return;
            }

            found.engine.name =
                data.name;

            found.engine.url =
                data.url;

            if (
                found.group.id !==
                data.group.id
            ) {
                found.group.engines =
                    found.group.engines.filter(
                        engine =>
                            engine.id !==
                            found.engine.id
                    );

                data.group.engines.push(
                    found.engine
                );
            }
        } else {
            data.group.engines.push({
                id: createId("engine"),
                name: data.name,
                url: data.url
            });
        }

        currentGroupId =
            data.group.id;

        saveConfig();

        cancelEditEngine();

        render();

        manageGroup.value =
            data.group.id;

        engineGroup.value =
            data.group.id;

        renderManageEngineList();
    }

    function deleteEngine(engineId) {
        const found =
            findEngine(engineId);

        if (!found) return;

        if (
            !confirm(
                `确定删除“${found.engine.name}”吗？`
            )
        ) {
            return;
        }

        found.group.engines =
            found.group.engines.filter(
                engine =>
                    engine.id !== engineId
            );

        config.selectedIds =
            config.selectedIds.filter(
                id =>
                    id !== engineId
            );

        if (
            editingEngineId ===
            engineId
        ) {
            cancelEditEngine();
        }

        saveConfig();

        render();

        manageGroup.value =
            found.group.id;

        renderManageEngineList();
    }

    // ============================================================
    // 快捷键录制
    // ============================================================

    function beginHotkeyRecording() {
        recordingHotkey = true;

        renderHotkey();

        hotkeyRecorder.focus();
    }

    function captureHotkey(event) {
        if (!recordingHotkey) {
            return false;
        }

        event.preventDefault();
        event.stopPropagation();

        const modifierOnly =
            [
                "Control",
                "Alt",
                "Shift",
                "Meta"
            ].includes(event.key);

        if (modifierOnly) {
            return true;
        }

        if (
            !event.ctrlKey &&
            !event.altKey &&
            !event.shiftKey
        ) {
            alert(
                "快捷键至少需要包含 Ctrl / Alt / Shift 之一。"
            );

            return true;
        }

        if (event.metaKey) {
            alert(
                "当前版本不使用 Meta / Win / Command 键，请改用 Ctrl / Alt / Shift。"
            );

            return true;
        }

        config.hotkey = {
            ctrl:
                !!event.ctrlKey,

            alt:
                !!event.altKey,

            shift:
                !!event.shiftKey,

            key:
                event.key === " "
                    ? "Space"
                    : String(
                        event.key || ""
                    ).toUpperCase(),

            code:
                String(
                    event.code || ""
                )
        };

        recordingHotkey =
            false;

        saveConfig();

        renderHotkey();

        return true;
    }

    // ============================================================
    // 导入 / 导出
    // ============================================================

    function exportConfig() {
        const payload = {
            app:
                "我的多引擎批量搜索",

            version:
                CONFIG_VERSION,

            exportedAt:
                new Date().toISOString(),

            config:
                deepClone(config)
        };

        const blob =
            new Blob(
                [
                    JSON.stringify(
                        payload,
                        null,
                        2
                    )
                ],
                {
                    type:
                        "application/json;charset=utf-8"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                "a"
            );

        a.href =
            url;

        a.download =
            `multi-search-v2-${new Date()
                .toISOString()
                .slice(0,10)}.json`;

        document.body.appendChild(
            a
        );

        a.click();

        a.remove();

        setTimeout(
            () =>
                URL.revokeObjectURL(
                    url
                ),
            1000
        );
    }

    function importConfigFromObject(raw) {
        const candidate =
            raw?.config ?? raw;

        const next =
            sanitizeConfig(
                candidate
            );

        if (
            !next.groups.length
        ) {
            throw new Error(
                "配置中没有有效分类"
            );
        }

        config =
            next;

        currentGroupId =
            config.groups[0]?.id ||
            null;

        saveConfig();

        cancelEditEngine();

        render();
    }

    function resetConfig() {
        if (
            !confirm(
                "确定恢复默认配置吗？你添加的分类、搜索引擎、快捷键和勾选状态都会被重置。"
            )
        ) {
            return;
        }

        config =
            makeDefaultConfig();

        currentGroupId =
            config.groups[0]?.id ||
            null;

        saveConfig();

        cancelEditEngine();

        render();
    }

    // ============================================================
    // 事件
    // ============================================================

    floatButton.addEventListener(
        "click",
        () => showPanel(false)
    );

    root
        .querySelector(
            "#msCloseV2"
        )
        .addEventListener(
            "click",
            hidePanel
        );

    root
        .querySelector(
            "#msBatchSearchV2"
        )
        .addEventListener(
            "click",
            batchSearch
        );

    root
        .querySelector(
            "#msSelectGroupV2"
        )
        .addEventListener(
            "click",
            selectCurrentGroup
        );

    root
        .querySelector(
            "#msClearGroupV2"
        )
        .addEventListener(
            "click",
            clearCurrentGroup
        );

    root
        .querySelector(
            "#msClearAllV2"
        )
        .addEventListener(
            "click",
            clearAll
        );

    settingsToggle.addEventListener(
        "click",
        () => {
            setSettingsOpen(
                !settingsOpen
            );
        }
    );

    manageGroup.addEventListener(
        "change",
        () => {
            currentGroupId =
                manageGroup.value;

            engineGroup.value =
                manageGroup.value;

            renderManageEngineList();

            renderSearch();
        }
    );

    root
        .querySelector(
            "#msAddGroupV2"
        )
        .addEventListener(
            "click",
            addGroup
        );

    root
        .querySelector(
            "#msRenameGroupV2"
        )
        .addEventListener(
            "click",
            renameGroup
        );

    root
        .querySelector(
            "#msDeleteGroupV2"
        )
        .addEventListener(
            "click",
            deleteGroup
        );

    saveEngineButton.addEventListener(
        "click",
        saveEngineFromForm
    );

    cancelEditEngineButton.addEventListener(
        "click",
        cancelEditEngine
    );

    hotkeyRecorder.addEventListener(
        "click",
        beginHotkeyRecording
    );

    showFloatButtonInput.addEventListener(
        "change",
        () => {
            config.showFloatButton =
                showFloatButtonInput.checked;

            saveConfig();

            applyFloatButtonVisibility();
        }
    );

    root
        .querySelector(
            "#msExportConfigV2"
        )
        .addEventListener(
            "click",
            exportConfig
        );

    root
        .querySelector(
            "#msImportConfigV2"
        )
        .addEventListener(
            "click",
            () => {
                importFileInput.click();
            }
        );

    root
        .querySelector(
            "#msResetConfigV2"
        )
        .addEventListener(
            "click",
            resetConfig
        );

    importFileInput.addEventListener(
        "change",
        async () => {
            const file =
                importFileInput.files?.[0];

            if (!file) return;

            try {
                const text =
                    await file.text();

                const raw =
                    JSON.parse(text);

                importConfigFromObject(
                    raw
                );

                alert(
                    "配置导入成功。"
                );
            } catch (error) {
                alert(
                    `导入失败：${
                        error.message ||
                        error
                    }`
                );
            } finally {
                importFileInput.value =
                    "";
            }
        }
    );

    // ============================================================
    // 输入框快捷操作
    // ============================================================

    keywordInput.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Enter"
            ) {
                event.preventDefault();

                batchSearch();
            }

            if (
                event.key === "Escape"
            ) {
                hidePanel();
            }
        }
    );

    // ============================================================
    // 全局快捷键
    // ============================================================

    document.addEventListener(
        "keydown",
        event => {

            // 正在录制快捷键时
            // 优先交给录制器

            if (
                captureHotkey(event)
            ) {
                return;
            }

            // 用户设置的快捷键

            if (
                isHotkeyMatch(event)
            ) {
                event.preventDefault();

                event.stopPropagation();

                togglePanel();

                return;
            }

            // ESC 关闭

            if (
                event.key ===
                    "Escape" &&
                panel.classList.contains(
                    "show"
                )
            ) {
                hidePanel();
            }

        },
        true
    );

    // ============================================================
    // 油猴菜单
    // ============================================================

    try {

        GM_registerMenuCommand(
            "打开多引擎搜索",
            () => {
                showPanel(false);
            }
        );

        GM_registerMenuCommand(
            "打开多引擎搜索设置",
            () => {
                showPanel(true);
            }
        );

    } catch (error) {

        console.warn(
            "[多引擎搜索] 注册油猴菜单失败：",
            error
        );

    }

    // ============================================================
    // 初始化
    // ============================================================

    render();

})();
