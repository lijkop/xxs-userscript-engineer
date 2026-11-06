// ==UserScript==
// @name         论坛回复水帖过滤器
// @name:en      Forum Reply Noise Filter
// @namespace    https://github.com/lijkop/xxs-userscript-engineer
// @version      1.0.0
// @description  在 Linux.do 与 V2EX 隐藏命中共享关键词的回复，可忽略引用和代码块。
// @description:zh-CN 在 Linux.do 与 V2EX 隐藏命中共享关键词的回复，可忽略引用和代码块。
// @description:en Hide matching replies on Linux.do and V2EX with one shared keyword list.
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/forum-reply-waterpost-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/forum-reply-waterpost-filter.user.js
// @match        https://linux.do/*
// @match        https://*.linux.do/*
// @match        https://www.v2ex.com/*
// @match        https://v2ex.com/*
// @match        https://*.v2ex.com/*
// @license      MIT
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'forum-reply-waterpost-filter:keywords:v1';
    const HIDDEN_ATTRIBUTE = 'data-forum-waterpost-hidden';
    const DEFAULT_WORDS = [
        '多谢',
        '节日快乐',
        '待我尝尝鲜',
        '谢谢',
        '有用，',
        '有用！',
        '感谢',
        '感谢佬',
        '神了佬',
        '牛逼'
    ];

    function normalize(value) {
        return String(value || '')
            .normalize('NFKC')
            .trim()
            .toLowerCase();
    }

    function uniqueWords(values) {
        const seen = new Set();
        return values
            .map(value => String(value).trim())
            .filter(value => {
                const key = normalize(value);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    function loadWords() {
        const stored = GM_getValue(STORAGE_KEY, null);
        if (Array.isArray(stored)) return uniqueWords(stored);

        const defaults = DEFAULT_WORDS.slice();
        GM_setValue(STORAGE_KEY, defaults);
        return defaults;
    }

    let words = loadWords();

    const adapters = {
        linuxdo: {
            matches: hostname => hostname === 'linux.do' || hostname.endsWith('.linux.do'),
            replies: () => [...document.querySelectorAll('.topic-post[data-post-number]')]
                .filter(post => Number(post.getAttribute('data-post-number')) > 1)
                .map(root => ({
                    root,
                    content: root.querySelector('.post__contents .cooked')
                        || root.querySelector('.topic-body .cooked')
                        || root.querySelector('.cooked')
                }))
                .filter(reply => reply.content)
        },
        v2ex: {
            matches: hostname => hostname === 'v2ex.com' || hostname.endsWith('.v2ex.com'),
            replies: () => [...document.querySelectorAll('.reply_content')]
                .map(content => ({
                    root: content.closest('.cell') || content.closest('.comment'),
                    content
                }))
                .filter(reply => reply.root)
        }
    };

    const adapter = Object.values(adapters).find(item => item.matches(location.hostname));
    if (!adapter) return;

    function addStyle() {
        if (document.getElementById('forum-waterpost-filter-style')) return;
        const style = document.createElement('style');
        style.id = 'forum-waterpost-filter-style';
        style.textContent = `[${HIDDEN_ATTRIBUTE}] { display: none !important; }`;
        (document.head || document.documentElement).appendChild(style);
    }

    function replyText(content) {
        const clone = content.cloneNode(true);
        clone.querySelectorAll('blockquote, pre, code, .quote').forEach(node => node.remove());
        return normalize(clone.textContent);
    }

    function scan() {
        document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`).forEach(node => {
            node.removeAttribute(HIDDEN_ATTRIBUTE);
        });

        const normalizedWords = words.map(normalize).filter(Boolean);
        if (!normalizedWords.length) return;

        adapter.replies().forEach(({ root, content }) => {
            const text = replyText(content);
            if (normalizedWords.some(word => text.includes(word))) {
                root.setAttribute(HIDDEN_ATTRIBUTE, '');
            }
        });
    }

    let scanTimer = null;
    function scheduleScan() {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(scan, 180);
    }

    function editWords() {
        const input = prompt(
            '编辑共享回复屏蔽词（每行一个，也可用英文逗号或分号分隔）：',
            words.join('\n')
        );
        if (input === null) return;

        words = uniqueWords(input.split(/[\r\n,;；]+/));
        GM_setValue(STORAGE_KEY, words);
        scan();
        alert(`共享回复屏蔽词已保存：${words.length} 个`);
    }

    addStyle();
    GM_registerMenuCommand('编辑共享回复屏蔽词', editWords);
    new MutationObserver(scheduleScan).observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
    });
    scan();
})();
