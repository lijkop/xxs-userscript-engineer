// ==UserScript==
// @name         小黑盒弹窗自动关闭
// @name:en      HeyBox Popup Auto Dismiss
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  自动点击小黑盒页面上的“取消”按钮，关闭干扰弹窗。
// @description:en Automatically clicks the "Cancel" button in popups on Xiaoheihe (HeyBox) pages.
// @author       小小薯 (XXS)
// @homepage     https://github.com/XXS-pickle/xxs-userscript-engineer
// @supportURL   https://github.com/XXS-pickle/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/XXS-pickle/xxs-userscript-engineer/main/scripts/heybox-popup-dismiss.user.js
// @downloadURL  https://raw.githubusercontent.com/XXS-pickle/xxs-userscript-engineer/main/scripts/heybox-popup-dismiss.user.js
// @match        https://www.xiaoheihe.cn/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function clickCancel() {
        // 查找包含“取消”的按钮
        const btns = document.querySelectorAll('button, div, span');
        for (const btn of btns) {
            if (btn.innerText.trim() === '取消') {
                console.log('Auto-clicking cancel button');
                btn.click();
                return true;
            }
        }
        return false;
    }

    // 初次尝试
    clickCancel();

    // 监听 DOM 变化，弹窗出现时自动点击
    const observer = new MutationObserver(() => {
        clickCancel();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
