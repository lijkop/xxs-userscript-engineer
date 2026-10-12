// ==UserScript==
// @name         知乎自动展开全部回答
// @name:en      Zhihu Auto Expand Answers
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  自动点击知乎问答页的“查看全部回答”，不触发页面滚动。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:zh-CN 自动点击知乎问答页的“查看全部回答”，不触发页面滚动。反馈问题请加入 Telegram 频道：https://t.me/zzyyffxx，通过这里联系我，修 Bug 更快。
// @description:en Auto-clicks "view all answers" on Zhihu question pages without scrolling the page. Feedback via Telegram: https://t.me/zzyyffxx
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/zhihu-auto-expand-answers.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/zhihu-auto-expand-answers.user.js
// @match        *://*.zhihu.com/question/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    let clicked = false;

    const observer = new MutationObserver(() => {
        if (clicked) return;

        // 查找“查看全部回答”按钮
        const viewAllBtn = document.querySelector('a.QuestionMainAction.ViewAll-QuestionMainAction');

        if (viewAllBtn) {
            clicked = true;
            console.log("[知乎脚本] 自动点击 '查看全部回答' 按钮");
            viewAllBtn.click();
        }
    });

    // 监听整个页面，保证异步加载按钮也能点到
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 页面加载后尝试一次
    setTimeout(() => {
        const btn = document.querySelector('a.QuestionMainAction.ViewAll-QuestionMainAction');
        if (btn && !clicked) {
            clicked = true;
            console.log("[知乎脚本] 页面初始点击 '查看全部回答'");
            btn.click();
        }
    }, 1000);
})();
