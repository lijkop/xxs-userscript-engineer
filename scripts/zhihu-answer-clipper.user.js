// ==UserScript==
// @name         知乎回答剪藏
// @name:en      Zhihu Answer Clipper
// @namespace    http://tampermonkey.net/
// @version      1.6.1
// @description  提取知乎问题页的回答正文并复制到剪贴板，便于剪藏保存。
// @description:en Extract Zhihu answer content and copy it to the clipboard for clipping.
// @author       小小薯 (XXS)
// @homepage     https://github.com/lijkop/xxs-userscript-engineer
// @supportURL   https://github.com/lijkop/xxs-userscript-engineer/issues
// @updateURL    https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/zhihu-answer-clipper.user.js
// @downloadURL  https://raw.githubusercontent.com/lijkop/xxs-userscript-engineer/main/scripts/zhihu-answer-clipper.user.js
// @match        *://*.zhihu.com/question/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let allAnswersData = [];
    const grabbedIds = new Set();
    let grabbing = false;
    let observer = null;

    const box = document.createElement("div");
    Object.assign(box.style, {
        position: "fixed", bottom: "80px", right: "20px", width: "360px", height: "420px",
        background: "#1a1a1a", color: "#fff", fontSize: "13px",
        borderRadius: "12px", overflowY: "auto", zIndex: "9999999",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)", display: "none",
        border: "1px solid #333", fontFamily: "system-ui, sans-serif"
    });
    document.body.appendChild(box);

    const btn = document.createElement("button");
    btn.textContent = "🔍 抓取回答";
    Object.assign(btn.style, {
        position: "fixed", bottom: "20px", right: "20px", padding: "12px 20px",
        borderRadius: "25px", border: "none", background: "#0066ff", color: "#fff",
        cursor: "pointer", zIndex: "9999999", fontSize: "14px", fontWeight: "bold"
    });
    document.body.appendChild(btn);

    function collectAnswers() {
        const items = document.querySelectorAll('.AnswerItem');
        let added = 0;

        items.forEach((item) => {
            const aid = item.getAttribute('name');
            if (aid && !grabbedIds.has(aid)) {
                const authorEl = item.querySelector('.AuthorInfo-name .UserLink-link');
                const author = authorEl ? authorEl.innerText.trim() : "匿名用户";
                const timeEl = item.querySelector('.ContentItem-time');
                const time = timeEl ? timeEl.innerText.replace(/发布于 |编辑于 /g, "").trim() : "未知时间";
                const contentEl = item.querySelector('.RichText.ztext');
                const content = contentEl ? contentEl.innerText.trim() : "";

                if (content) {
                    allAnswersData.push({ author, time, content });
                    grabbedIds.add(aid);
                    added++;
                }
            }
        });
        if (added > 0) renderBox();
    }

    function renderBox() {
        box.innerHTML = "";
        box.style.display = "block";

        const title = document.createElement("div");
        title.style.cssText = "padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;";
        title.innerHTML = `
            <span style="font-weight:bold; color:#4a9eff; font-size:14px;">📡 已抓取 ${allAnswersData.length} 条</span>
            <button id="clipper-close" style="background:#444; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">✕ 关闭</button>
        `;
        box.appendChild(title);

        const tips = document.createElement("div");
        tips.style.cssText = "padding:10px 15px; color:#888; font-size:11px;";
        tips.textContent = "回答过长可分批复制";
        box.appendChild(tips);

        const copyBtn = document.createElement("button");
        copyBtn.id = "clipper-copy";
        copyBtn.textContent = "📋 复制到剪贴板";
        Object.assign(copyBtn.style, {
            display: "block", width: "90%", margin: "10px auto", padding: "14px",
            background: "#2ea44f", color: "#fff", border: "none", borderRadius: "8px",
            cursor: "pointer", fontSize: "14px", fontWeight: "bold"
        });
        copyBtn.onclick = copyToClipboard;
        box.appendChild(copyBtn);

        const clearBtn = document.createElement("button");
        clearBtn.textContent = "🗑 清空重试";
        Object.assign(clearBtn.style, {
            display: "block", width: "90%", margin: "0 auto 15px", padding: "10px",
            background: "#444", color: "#fff", border: "none", borderRadius: "6px",
            cursor: "pointer", fontSize: "12px"
        });
        clearBtn.onclick = () => {
            allAnswersData = [];
            grabbedIds.clear();
            box.style.display = "none";
        };
        box.appendChild(clearBtn);

        const listTitle = document.createElement("div");
        listTitle.style.cssText = "padding:10px 15px 5px; color:#888; font-size:11px;";
        listTitle.textContent = "预览:";
        box.appendChild(listTitle);

        allAnswersData.slice(0, 15).forEach((data, index) => {
            const item = document.createElement("div");
            item.style.cssText = "margin:5px 15px; padding:10px; background:#252525; border-radius:6px;";
            item.innerHTML = `<strong>#${index + 1}</strong> ${data.author} <span style="color:#666">(${data.time})</span>`;
            box.appendChild(item);
        });

        if (allAnswersData.length > 15) {
            const more = document.createElement("div");
            more.style.cssText = "padding:10px 15px; color:#666; text-align:center;";
            more.textContent = `...还有 ${allAnswersData.length - 15} 条`;
            box.appendChild(more);
        }

        document.getElementById('clipper-close').onclick = () => box.style.display = "none";
    }

    function copyToClipboard() {
        if (allAnswersData.length === 0) {
            alert("没有可复制的内容");
            return;
        }

        const questionTitleEl = document.querySelector('.QuestionHeader-title');
        const questionTitle = questionTitleEl ? questionTitleEl.innerText.trim() : "未命名问题";
        const questionLink = window.location.href.split('?')[0];

        let md = `# ${questionTitle}\n\n**链接**: ${questionLink}\n\n---\n\n`;
        allAnswersData.forEach((data, index) => {
            md += `### 回答${index + 1} | ${data.author}\n**时间**: ${data.time}\n\n${data.content}\n\n---\n\n`;
        });

        navigator.clipboard.writeText(md).then(() => {
            alert(`已复制 ${allAnswersData.length} 条回答到剪贴板`);
            allAnswersData = [];
            grabbedIds.clear();
            box.style.display = "none";
        }).catch(() => {
            alert("复制失败，请重试");
        });
    }

    btn.addEventListener("click", () => {
        if (!grabbing) {
            box.style.display = "block";
            grabbing = true;
            collectAnswers();
            observer = new MutationObserver(() => collectAnswers());
            observer.observe(document.body, { childList: true, subtree: true });
            btn.textContent = "🛑 停止";
            btn.style.background = "#e44";
        } else {
            grabbing = false;
            if (observer) observer.disconnect();
            btn.textContent = "🔍 抓取回答";
            btn.style.background = "#0066ff";
        }
    });

})();
