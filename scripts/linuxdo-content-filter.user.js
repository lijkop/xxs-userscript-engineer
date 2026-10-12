// ==UserScript==
// @name         Linux.do 内容过滤器
// @name:en      Linux.do Content Filter
// @namespace    https://linux.do/
// @version      1.0.0
// @description  按关键词过滤 Linux.do 的标签、标题、主帖正文与评论回复。
// @description:en Keyword filter for Linux.do tags, titles, post bodies and replies.
// @author       小小薯 (XXS)
// @homepage     https://github.com/XXS-pickle/userscripts
// @supportURL   https://github.com/XXS-pickle/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/linuxdo-content-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/XXS-pickle/userscripts/main/scripts/linuxdo-content-filter.user.js
// @match        https://linux.do/*
// @match        https://*.linux.do/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_NAME = 'Linux.do Content Filter';
    const STORAGE_KEY = 'ldcf-config-v1';

    const DEFAULT_CONFIG = {
        enabled: true,

        tagEnabled: true,
        titleEnabled: true,
        mainPostEnabled: true,
        replyEnabled: true,

        blockedTags: [],
        blockedTitleKeywords: [],
        blockedMainPostKeywords: [],
        blockedReplyKeywords: [],

        ignoreQuoteAndCode: true
    };

    let config = loadConfig();

    let observer = null;
    let scanTimer = null;
    let currentUrl = location.href;

    // ============================================================
    // 配置
    // ============================================================

    function cloneDefaultConfig() {
        return JSON.parse(
            JSON.stringify(DEFAULT_CONFIG)
        );
    }

    function loadConfig() {
        try {
            const stored = GM_getValue(
                STORAGE_KEY,
                null
            );

            if (!stored) {
                return cloneDefaultConfig();
            }

            const parsed =
                typeof stored === 'string'
                    ? JSON.parse(stored)
                    : stored;

            return {
                ...cloneDefaultConfig(),
                ...parsed
            };
        } catch (error) {
            console.error(
                `[${SCRIPT_NAME}] 读取配置失败`,
                error
            );

            return cloneDefaultConfig();
        }
    }

    function saveConfig() {
        try {
            GM_setValue(
                STORAGE_KEY,
                config
            );
        } catch (error) {
            console.error(
                `[${SCRIPT_NAME}] 保存配置失败`,
                error
            );
        }
    }

    // ============================================================
    // 文本工具
    // ============================================================

    function normalize(value) {
        return String(value || '')
            .normalize('NFKC')
            .trim()
            .toLocaleLowerCase();
    }

    function linesToArray(value) {
        return String(value || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);
    }

    function normalizeList(list) {
        if (!Array.isArray(list)) {
            return [];
        }

        return list
            .map(normalize)
            .filter(Boolean);
    }

    function findKeyword(text, keywords) {
        const source = normalize(text);

        if (!source) {
            return null;
        }

        const list =
            normalizeList(keywords);

        for (const keyword of list) {
            if (source.includes(keyword)) {
                return keyword;
            }
        }

        return null;
    }

    function findTag(tags) {
        const blocked =
            new Set(
                normalizeList(
                    config.blockedTags
                )
            );

        for (const tag of tags) {
            const normalizedTag =
                normalize(tag);

            if (
                normalizedTag &&
                blocked.has(normalizedTag)
            ) {
                return normalizedTag;
            }
        }

        return null;
    }

    // ============================================================
    // 隐藏机制
    //
    // 重要：
    // 不使用 class 隐藏。
    //
    // Discourse 会动态重写 class，
    // 之前评论过滤失效就是因为隐藏 class 被覆盖。
    // ============================================================

    function hideElement(
        element,
        reason,
        type
    ) {
        if (!element) {
            return;
        }

        element.setAttribute(
            'data-ldcf-hidden',
            '1'
        );

        element.setAttribute(
            'data-ldcf-reason',
            reason || ''
        );

        element.setAttribute(
            'data-ldcf-type',
            type || ''
        );
    }

    function showElement(element) {
        if (!element) {
            return;
        }

        element.removeAttribute(
            'data-ldcf-hidden'
        );

        element.removeAttribute(
            'data-ldcf-reason'
        );

        element.removeAttribute(
            'data-ldcf-type'
        );
    }

    function showAll() {
        document
            .querySelectorAll(
                '[data-ldcf-hidden="1"]'
            )
            .forEach(showElement);
    }

    // ============================================================
    // CSS
    // ============================================================

    function injectStyle() {
        if (
            document.getElementById(
                'ldcf-style'
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id = 'ldcf-style';

        style.textContent = `

            /*
             * 核心隐藏规则。
             * 使用 data 属性，
             * 避免 Discourse 重写 class 导致屏蔽失效。
             */
            [data-ldcf-hidden="1"] {
                display: none !important;
            }


            #ldcf-open-button {
                position: fixed;
                right: 20px;
                bottom: 20px;

                z-index: 999998;

                border: 1px solid rgba(127,127,127,.25);
                border-radius: 9px;

                padding: 9px 14px;

                background: var(--primary, #222);
                color: var(--secondary, #fff);

                font-size: 14px;
                font-weight: 600;
                line-height: 1.2;

                cursor: pointer;

                box-shadow:
                    0 5px 20px
                    rgba(0,0,0,.25);
            }


            #ldcf-open-button:hover {
                opacity: .88;
            }


            #ldcf-overlay {
                position: fixed;
                inset: 0;

                z-index: 999999;

                display: none;

                align-items: center;
                justify-content: center;

                padding: 18px;

                background:
                    rgba(0,0,0,.58);
            }


            #ldcf-overlay.ldcf-visible {
                display: flex;
            }


            #ldcf-panel {
                width: min(
                    760px,
                    96vw
                );

                max-height: 92vh;

                overflow-y: auto;

                padding: 20px;

                border-radius: 12px;

                background:
                    var(--secondary, #fff);

                color:
                    var(--primary, #222);

                box-shadow:
                    0 18px 60px
                    rgba(0,0,0,.4);

                box-sizing: border-box;
            }


            #ldcf-panel * {
                box-sizing: border-box;
            }


            .ldcf-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                gap: 15px;

                margin-bottom: 18px;
            }


            .ldcf-header-title {
                font-size: 21px;
                font-weight: 700;
            }


            .ldcf-close {
                width: 34px;
                height: 34px;

                border: none;
                border-radius: 7px;

                background:
                    rgba(127,127,127,.15);

                color: inherit;

                cursor: pointer;

                font-size: 22px;
                line-height: 32px;
            }


            .ldcf-master {
                margin-bottom: 22px;

                border:
                    1px solid
                    rgba(127,127,127,.18);

                border-radius: 9px;

                padding: 0 12px;
            }


            .ldcf-row {
                display: flex;
                align-items: center;
                justify-content: space-between;

                gap: 15px;

                min-height: 54px;

                border-bottom:
                    1px solid
                    rgba(127,127,127,.13);
            }


            .ldcf-row:last-child {
                border-bottom: none;
            }


            .ldcf-row-title {
                font-size: 14px;
                font-weight: 600;
            }


            .ldcf-row-description {
                margin-top: 3px;

                font-size: 12px;
                line-height: 1.45;

                opacity: .65;
            }


            .ldcf-section {
                margin-bottom: 22px;
            }


            .ldcf-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                gap: 12px;

                margin-bottom: 6px;
            }


            .ldcf-section-title {
                font-size: 15px;
                font-weight: 700;
            }


            .ldcf-description {
                margin-bottom: 8px;

                font-size: 12px;
                line-height: 1.5;

                opacity: .68;
            }


            .ldcf-textarea {
                display: block;

                width: 100%;
                min-height: 110px;

                resize: vertical;

                padding: 10px 12px;

                border:
                    1px solid
                    rgba(127,127,127,.35);

                border-radius: 8px;

                outline: none;

                background:
                    var(--secondary, #fff);

                color:
                    var(--primary, #222);

                font-family: inherit;
                font-size: 14px;
                line-height: 1.55;
            }


            .ldcf-textarea:focus {
                border-color:
                    var(
                        --tertiary,
                        #2789ff
                    );
            }


            .ldcf-switch {
                appearance: none;
                -webkit-appearance: none;

                position: relative;

                flex: 0 0 auto;

                width: 42px;
                height: 24px;

                margin: 0;

                border: none;
                border-radius: 30px;

                background: #777;

                cursor: pointer;

                transition:
                    background .15s ease;
            }


            .ldcf-switch::after {
                content: '';

                position: absolute;

                top: 3px;
                left: 3px;

                width: 18px;
                height: 18px;

                border-radius: 50%;

                background: white;

                transition:
                    transform .15s ease;
            }


            .ldcf-switch:checked {
                background:
                    var(
                        --tertiary,
                        #2789ff
                    );
            }


            .ldcf-switch:checked::after {
                transform:
                    translateX(18px);
            }


            .ldcf-footer {
                position: sticky;

                bottom: -20px;

                display: flex;

                gap: 10px;

                margin:
                    10px -20px -20px;

                padding:
                    14px 20px;

                border-top:
                    1px solid
                    rgba(127,127,127,.18);

                background:
                    var(--secondary, #fff);
            }


            .ldcf-button {
                padding:
                    9px 16px;

                border: none;
                border-radius: 7px;

                cursor: pointer;

                font-size: 14px;
                font-weight: 600;
            }


            .ldcf-save {
                margin-left: auto;

                background:
                    var(
                        --tertiary,
                        #2789ff
                    );

                color: #fff;
            }


            .ldcf-cancel {
                background:
                    rgba(127,127,127,.16);

                color: inherit;
            }


            .ldcf-clear {
                background: #c83e3e;
                color: #fff;
            }


            #ldcf-toast {
                position: fixed;

                left: 50%;
                bottom: 84px;

                z-index: 1000000;

                transform:
                    translateX(-50%);

                padding:
                    9px 15px;

                border-radius: 7px;

                background: #111;
                color: #fff;

                font-size: 13px;

                opacity: 0;

                pointer-events: none;

                transition:
                    opacity .18s ease;
            }


            #ldcf-toast.ldcf-visible {
                opacity: 1;
            }


            @media (max-width: 600px) {

                #ldcf-open-button {
                    right: 12px;
                    bottom: 14px;
                }

                #ldcf-overlay {
                    padding: 8px;
                }

                #ldcf-panel {
                    width: 100%;
                    max-height: 96vh;

                    padding: 16px;
                }

                .ldcf-footer {
                    bottom: -16px;

                    margin:
                        10px -16px -16px;

                    padding:
                        12px 16px;
                }

            }

        `;

        (
            document.head ||
            document.documentElement
        ).appendChild(style);
    }

    // ============================================================
    // 面板
    // ============================================================

    function createUI() {
        if (!document.body) {
            return;
        }

        if (
            document.getElementById(
                'ldcf-open-button'
            )
        ) {
            return;
        }

        const openButton =
            document.createElement(
                'button'
            );

        openButton.id =
            'ldcf-open-button';

        openButton.type =
            'button';

        openButton.textContent =
            '过滤设置';

        openButton.addEventListener(
            'click',
            openPanel
        );

        document.body.appendChild(
            openButton
        );


        const overlay =
            document.createElement(
                'div'
            );

        overlay.id =
            'ldcf-overlay';

        overlay.innerHTML = `

            <div
                id="ldcf-panel"
                role="dialog"
                aria-modal="true"
            >

                <div class="ldcf-header">

                    <div class="ldcf-header-title">
                        Linux.do 过滤设置
                    </div>

                    <button
                        id="ldcf-close"
                        class="ldcf-close"
                        type="button"
                        title="关闭"
                    >
                        ×
                    </button>

                </div>


                <div class="ldcf-master">

                    <div class="ldcf-row">

                        <div>

                            <div class="ldcf-row-title">
                                启用过滤器
                            </div>

                            <div class="ldcf-row-description">
                                关闭后立即恢复所有被隐藏内容
                            </div>

                        </div>

                        <input
                            id="ldcf-enabled"
                            class="ldcf-switch"
                            type="checkbox"
                        >

                    </div>


                    <div class="ldcf-row">

                        <div>

                            <div class="ldcf-row-title">
                                评论忽略引用和代码块
                            </div>

                            <div class="ldcf-row-description">
                                防止别人引用垃圾回复时被一起误杀
                            </div>

                        </div>

                        <input
                            id="ldcf-ignore-quote"
                            class="ldcf-switch"
                            type="checkbox"
                        >

                    </div>

                </div>


                <div class="ldcf-section">

                    <div class="ldcf-section-header">

                        <div class="ldcf-section-title">
                            标签屏蔽
                        </div>

                        <input
                            id="ldcf-tag-enabled"
                            class="ldcf-switch"
                            type="checkbox"
                        >

                    </div>

                    <div class="ldcf-description">
                        每行一个标签，按完整标签名匹配。
                        例如填写「公益推广」不会误伤其他标签。
                    </div>

                    <textarea
                        id="ldcf-tags"
                        class="ldcf-textarea"
                        placeholder="纯水&#10;公益推广&#10;抽奖"
                    ></textarea>

                </div>


                <div class="ldcf-section">

                    <div class="ldcf-section-header">

                        <div class="ldcf-section-title">
                            标题关键词
                        </div>

                        <input
                            id="ldcf-title-enabled"
                            class="ldcf-switch"
                            type="checkbox"
                        >

                    </div>

                    <div class="ldcf-description">
                        每行一个关键词。
                        标题只要包含其中一个关键词，就隐藏整个主题。
                    </div>

                    <textarea
                        id="ldcf-title-keywords"
                        class="ldcf-textarea"
                        placeholder="机场&#10;求码&#10;拼车"
                    ></textarea>

                </div>


                <div class="ldcf-section">

                    <div class="ldcf-section-header">

                        <div class="ldcf-section-title">
                            主帖正文关键词
                        </div>

                        <input
                            id="ldcf-main-enabled"
                            class="ldcf-switch"
                            type="checkbox"
                        >

                    </div>

                    <div class="ldcf-description">
                        只检查第 1 楼正文。
                        命中后隐藏第 1 楼。
                    </div>

                    <textarea
                        id="ldcf-main-keywords"
                        class="ldcf-textarea"
                        placeholder="返利链接&#10;推广链接"
                    ></textarea>

                </div>


                <div class="ldcf-section">

                    <div class="ldcf-section-header">

                        <div class="ldcf-section-title">
                            评论 / 回复关键词
                        </div>

                        <input
                            id="ldcf-reply-enabled"
                            class="ldcf-switch"
                            type="checkbox"
                        >

                    </div>

                    <div class="ldcf-description">
                        从第 2 楼开始检查。
                        命中后直接隐藏整个楼层。
                    </div>

                    <textarea
                        id="ldcf-reply-keywords"
                        class="ldcf-textarea"
                        placeholder="蹲&#10;mark&#10;插眼&#10;多谢&#10;感谢分享"
                    ></textarea>

                </div>


                <div class="ldcf-footer">

                    <button
                        id="ldcf-clear"
                        class="ldcf-button ldcf-clear"
                        type="button"
                    >
                        清空设置
                    </button>

                    <button
                        id="ldcf-cancel"
                        class="ldcf-button ldcf-cancel"
                        type="button"
                    >
                        取消
                    </button>

                    <button
                        id="ldcf-save"
                        class="ldcf-button ldcf-save"
                        type="button"
                    >
                        保存设置
                    </button>

                </div>

            </div>

        `;

        document.body.appendChild(
            overlay
        );


        const toast =
            document.createElement(
                'div'
            );

        toast.id =
            'ldcf-toast';

        document.body.appendChild(
            toast
        );


        document
            .getElementById(
                'ldcf-close'
            )
            .addEventListener(
                'click',
                closePanel
            );


        document
            .getElementById(
                'ldcf-cancel'
            )
            .addEventListener(
                'click',
                closePanel
            );


        document
            .getElementById(
                'ldcf-save'
            )
            .addEventListener(
                'click',
                savePanel
            );


        document
            .getElementById(
                'ldcf-clear'
            )
            .addEventListener(
                'click',
                clearPanel
            );


        overlay.addEventListener(
            'click',
            event => {
                if (
                    event.target ===
                    overlay
                ) {
                    closePanel();
                }
            }
        );


        document.addEventListener(
            'keydown',
            event => {
                if (
                    event.key ===
                    'Escape'
                ) {
                    closePanel();
                }
            }
        );
    }

    function getElement(id) {
        return document.getElementById(id);
    }

    function fillPanel() {
        getElement(
            'ldcf-enabled'
        ).checked =
            config.enabled;

        getElement(
            'ldcf-ignore-quote'
        ).checked =
            config.ignoreQuoteAndCode;

        getElement(
            'ldcf-tag-enabled'
        ).checked =
            config.tagEnabled;

        getElement(
            'ldcf-title-enabled'
        ).checked =
            config.titleEnabled;

        getElement(
            'ldcf-main-enabled'
        ).checked =
            config.mainPostEnabled;

        getElement(
            'ldcf-reply-enabled'
        ).checked =
            config.replyEnabled;

        getElement(
            'ldcf-tags'
        ).value =
            config.blockedTags.join(
                '\n'
            );

        getElement(
            'ldcf-title-keywords'
        ).value =
            config
                .blockedTitleKeywords
                .join('\n');

        getElement(
            'ldcf-main-keywords'
        ).value =
            config
                .blockedMainPostKeywords
                .join('\n');

        getElement(
            'ldcf-reply-keywords'
        ).value =
            config
                .blockedReplyKeywords
                .join('\n');
    }

    function openPanel() {
        fillPanel();

        getElement(
            'ldcf-overlay'
        ).classList.add(
            'ldcf-visible'
        );
    }

    function closePanel() {
        const overlay =
            getElement(
                'ldcf-overlay'
            );

        if (!overlay) {
            return;
        }

        overlay.classList.remove(
            'ldcf-visible'
        );
    }

    function savePanel() {
        config.enabled =
            getElement(
                'ldcf-enabled'
            ).checked;

        config.ignoreQuoteAndCode =
            getElement(
                'ldcf-ignore-quote'
            ).checked;

        config.tagEnabled =
            getElement(
                'ldcf-tag-enabled'
            ).checked;

        config.titleEnabled =
            getElement(
                'ldcf-title-enabled'
            ).checked;

        config.mainPostEnabled =
            getElement(
                'ldcf-main-enabled'
            ).checked;

        config.replyEnabled =
            getElement(
                'ldcf-reply-enabled'
            ).checked;

        config.blockedTags =
            linesToArray(
                getElement(
                    'ldcf-tags'
                ).value
            );

        config.blockedTitleKeywords =
            linesToArray(
                getElement(
                    'ldcf-title-keywords'
                ).value
            );

        config.blockedMainPostKeywords =
            linesToArray(
                getElement(
                    'ldcf-main-keywords'
                ).value
            );

        config.blockedReplyKeywords =
            linesToArray(
                getElement(
                    'ldcf-reply-keywords'
                ).value
            );

        saveConfig();

        closePanel();

        rescanEverything();

        showToast(
            '过滤设置已保存'
        );
    }

    function clearPanel() {
        const confirmed =
            window.confirm(
                '确定清空全部过滤规则吗？'
            );

        if (!confirmed) {
            return;
        }

        config =
            cloneDefaultConfig();

        saveConfig();

        fillPanel();

        rescanEverything();

        showToast(
            '过滤规则已清空'
        );
    }

    function showToast(text) {
        const toast =
            getElement(
                'ldcf-toast'
            );

        if (!toast) {
            return;
        }

        toast.textContent =
            text;

        toast.classList.add(
            'ldcf-visible'
        );

        clearTimeout(
            showToast.timer
        );

        showToast.timer =
            setTimeout(
                () => {
                    toast.classList.remove(
                        'ldcf-visible'
                    );
                },
                1500
            );
    }

    // ============================================================
    // 主页 / 列表页过滤
    //
    // 根据你提供的 Linux.do 实际 HTML：
    //
    // tr.topic-list-item
    // a.title.raw-link.raw-topic-link
    // .discourse-tags [data-tag-name]
    // ============================================================

    function getTopicTitle(row) {
        const title =
            row.querySelector(
                [
                    'a.title.raw-link.raw-topic-link',
                    'a.raw-topic-link',
                    '.main-link a.title',
                    'a.title'
                ].join(',')
            );

        if (!title) {
            return '';
        }

        return (
            title.innerText ||
            title.textContent ||
            ''
        ).trim();
    }

    function getTopicTags(row) {
        const result = [];

        row
            .querySelectorAll(
                [
                    '.discourse-tags [data-tag-name]',
                    'a.discourse-tag[data-tag-name]'
                ].join(',')
            )
            .forEach(
                element => {
                    const tag =
                        element.getAttribute(
                            'data-tag-name'
                        ) ||
                        element.textContent;

                    if (
                        tag &&
                        tag.trim()
                    ) {
                        result.push(
                            tag.trim()
                        );
                    }
                }
            );

        return result;
    }

    function filterTopicRow(row) {
        if (!row) {
            return;
        }

        if (!config.enabled) {
            showElement(row);
            return;
        }

        const title =
            getTopicTitle(row);

        const tags =
            getTopicTags(row);

        // 标题优先
        if (
            config.titleEnabled &&
            config
                .blockedTitleKeywords
                .length
        ) {
            const matched =
                findKeyword(
                    title,
                    config
                        .blockedTitleKeywords
                );

            if (matched) {
                hideElement(
                    row,
                    `标题：${matched}`,
                    'topic-title'
                );

                return;
            }
        }

        // 标签
        if (
            config.tagEnabled &&
            config.blockedTags.length
        ) {
            const matched =
                findTag(tags);

            if (matched) {
                hideElement(
                    row,
                    `标签：${matched}`,
                    'topic-tag'
                );

                return;
            }
        }

        showElement(row);
    }

    function filterTopicLists(
        root = document
    ) {
        const rows =
            new Set();

        if (
            root instanceof Element &&
            root.matches(
                'tr.topic-list-item'
            )
        ) {
            rows.add(root);
        }

        root
            .querySelectorAll?.(
                'tr.topic-list-item'
            )
            .forEach(
                row => rows.add(row)
            );

        rows.forEach(
            filterTopicRow
        );
    }

    // ============================================================
    // 帖子正文处理
    // ============================================================

    function getCleanText(
        content
    ) {
        if (!content) {
            return '';
        }

        if (
            !config.ignoreQuoteAndCode
        ) {
            return (
                content.innerText ||
                content.textContent ||
                ''
            ).trim();
        }

        const clone =
            content.cloneNode(true);

        clone
            .querySelectorAll(
                [
                    'blockquote',
                    'aside.quote',
                    '.quote',
                    'pre',
                    'code',
                    '.cooked-selection-barrier'
                ].join(',')
            )
            .forEach(
                element =>
                    element.remove()
            );

        return (
            clone.innerText ||
            clone.textContent ||
            ''
        ).trim();
    }

    // ============================================================
    // 评论 / 楼层过滤
    //
    // 根据你提供的实际 Linux.do 结构：
    //
    // <div class="topic-post"
    //      data-post-number="4">
    //
    //     ...
    //
    //     <div class="cooked">
    //         评论正文
    //     </div>
    //
    // </div>
    // ============================================================

    function getPostNumber(post) {
        if (!post) {
            return null;
        }

        const raw =
            post.getAttribute(
                'data-post-number'
            );

        const number =
            parseInt(
                raw,
                10
            );

        if (
            Number.isFinite(number)
        ) {
            return number;
        }

        const article =
            post.querySelector(
                'article[id^="post_"]'
            );

        if (article) {
            const match =
                article.id.match(
                    /^post_(\d+)$/
                );

            if (match) {
                return parseInt(
                    match[1],
                    10
                );
            }
        }

        return null;
    }

    function getPostContent(post) {
        if (!post) {
            return null;
        }

        return post.querySelector(
            '.post__contents .cooked, .topic-body .cooked, .cooked'
        );
    }

    function filterPost(post) {
        if (!post) {
            return;
        }

        if (!config.enabled) {
            showElement(post);
            return;
        }

        const postNumber =
            getPostNumber(post);

        const content =
            getPostContent(post);

        if (!content) {
            showElement(post);
            return;
        }

        const text =
            getCleanText(content);

        // --------------------------------------------------------
        // 主帖
        // --------------------------------------------------------

        if (postNumber === 1) {
            if (
                config.mainPostEnabled &&
                config
                    .blockedMainPostKeywords
                    .length
            ) {
                const matched =
                    findKeyword(
                        text,
                        config
                            .blockedMainPostKeywords
                    );

                if (matched) {
                    hideElement(
                        post,
                        `主帖：${matched}`,
                        'main-post'
                    );

                    return;
                }
            }

            showElement(post);

            return;
        }

        // --------------------------------------------------------
        // 评论 / 回复
        // --------------------------------------------------------

        if (
            postNumber !== null &&
            postNumber > 1
        ) {
            if (
                config.replyEnabled &&
                config
                    .blockedReplyKeywords
                    .length
            ) {
                const matched =
                    findKeyword(
                        text,
                        config
                            .blockedReplyKeywords
                    );

                if (matched) {
                    hideElement(
                        post,
                        `回复：${matched}`,
                        'reply'
                    );

                    return;
                }
            }
        }

        showElement(post);
    }

    function filterPosts(
        root = document
    ) {
        const posts =
            new Set();

        if (
            root instanceof Element &&
            root.matches(
                '.topic-post[data-post-number]'
            )
        ) {
            posts.add(root);
        }

        root
            .querySelectorAll?.(
                '.topic-post[data-post-number]'
            )
            .forEach(
                post =>
                    posts.add(post)
            );

        posts.forEach(
            filterPost
        );
    }

    // ============================================================
    // 扫描
    // ============================================================

    function scan(
        root = document
    ) {
        try {
            if (!config.enabled) {
                showAll();
                return;
            }

            filterTopicLists(root);
            filterPosts(root);
        } catch (error) {
            console.error(
                `[${SCRIPT_NAME}] 扫描失败`,
                error
            );
        }
    }

    function rescanEverything() {
        showAll();

        scan(document);
    }

    function scheduleScan() {
        clearTimeout(
            scanTimer
        );

        scanTimer =
            setTimeout(
                () => {
                    scan(document);
                },
                70
            );
    }

    // ============================================================
    // DOM 动态监听页面
    //
    // Discourse:
    // - SPA 页面切换
    // - 无限滚动
    // - 评论楼层动态创建
    // - 首页主题动态刷新
    //
    // 都依赖 MutationObserver。
    //
    // 注意：
    // 这里只监听 childList，
    // 不监听我们自己的 data 属性修改，
    // 避免 Observer 自己触发自己。
    // ============================================================

    function startObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer =
            new MutationObserver(
                mutations => {
                    let relevant = false;

                    for (
                        const mutation
                        of mutations
                    ) {
                        if (
                            mutation.type ===
                                'childList' &&
                            mutation
                                .addedNodes
                                .length
                        ) {
                            relevant = true;
                            break;
                        }
                    }

                    if (relevant) {
                        scheduleScan();
                    }
                }
            );

        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }

    // ============================================================
    // Discourse SPA 路由检测
    // ============================================================

    function watchUrl() {
        setInterval(
            () => {
                if (
                    currentUrl ===
                    location.href
                ) {
                    return;
                }

                currentUrl =
                    location.href;

                // 页面切换后延迟扫描，
                // 给 Ember / Discourse 时间完成 DOM 渲染。
                setTimeout(
                    () => {
                        rescanEverything();
                    },
                    80
                );

                setTimeout(
                    () => {
                        scan(document);
                    },
                    400
                );
            },
            300
        );
    }

    // ============================================================
    // 保险扫描
    //
    // 某些 Discourse 插件可能直接替换节点，
    // 极端情况下 MutationObserver 时机会漏一次。
    //
    // 每 1.2 秒做一次轻量扫描，
    // 因为只检查当前 DOM，
    // 且没有网络请求。
    // ============================================================

    function startSafetyScan() {
        setInterval(
            () => {
                scan(document);
            },
            1200
        );
    }

    // ============================================================
    // 初始化
    // ============================================================

    function initBody() {
        createUI();

        startObserver();

        watchUrl();

        startSafetyScan();

        scan(document);
    }

    function init() {
        injectStyle();

        if (document.body) {
            initBody();
            return;
        }

        const initObserver =
            new MutationObserver(
                () => {
                    if (!document.body) {
                        return;
                    }

                    initObserver.disconnect();

                    initBody();
                }
            );

        initObserver.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }

    init();

})();
