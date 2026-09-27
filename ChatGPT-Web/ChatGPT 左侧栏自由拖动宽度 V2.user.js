// ==UserScript==
// @name         ChatGPT 左侧栏自由拖动宽度 V2
// @namespace    chatgpt-sidebar-resizer
// @version      2.1
// @description  自动识别 ChatGPT 左侧栏边缘，拖动改变宽度并自动保存
// @license      MIT
// @homepageURL  https://github.com/RongNianXin/ChatGPT-Workflows/tree/main/ChatGPT-Web
// @supportURL   https://github.com/RongNianXin/ChatGPT-Workflows/issues
// @updateURL    https://raw.githubusercontent.com/RongNianXin/ChatGPT-Workflows/main/ChatGPT-Web/ChatGPT%20%E5%B7%A6%E4%BE%A7%E6%A0%8F%E8%87%AA%E7%94%B1%E6%8B%96%E5%8A%A8%E5%AE%BD%E5%BA%A6%20V2.user.js
// @downloadURL  https://raw.githubusercontent.com/RongNianXin/ChatGPT-Workflows/main/ChatGPT-Web/ChatGPT%20%E5%B7%A6%E4%BE%A7%E6%A0%8F%E8%87%AA%E7%94%B1%E6%8B%96%E5%8A%A8%E5%AE%BD%E5%BA%A6%20V2.user.js
// @match        https://chatgpt.com/*
// @match        https://www.chatgpt.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'chatgpt_sidebar_custom_width_v2';

    const MIN_WIDTH = 200;
    const MAX_WIDTH = 650;

    let dragging = false;
    let handle = null;
    let sidebar = null;
    let widthTargets = [];

    let savedWidth = parseInt(
        localStorage.getItem(STORAGE_KEY),
        10
    );

    if (!Number.isFinite(savedWidth)) {
        savedWidth = null;
    }


    // ---------------------------------------------------------
    // 1. 自动寻找 ChatGPT 左侧栏
    // ---------------------------------------------------------

    function findSidebar() {

        // 优先使用 ChatGPT 曾经/目前使用过的选择器
        const selectors = [
            '#stage-slideover-sidebar',
            '[data-testid="stage-slideover-sidebar"]',
            '[data-testid="sidebar"]',
            'aside'
        ];

        for (const selector of selectors) {

            const elements = document.querySelectorAll(selector);

            for (const el of elements) {

                const rect = el.getBoundingClientRect();

                if (
                    rect.width >= 180 &&
                    rect.width <= 700 &&
                    rect.height >= window.innerHeight * 0.6 &&
                    rect.left <= 10
                ) {
                    return el;
                }
            }
        }


        // -----------------------------------------------------
        // 如果官方 DOM 名称发生变化，就使用位置和尺寸自动判断
        // -----------------------------------------------------

        const all = document.querySelectorAll('body *');

        let best = null;
        let bestScore = -Infinity;

        for (const el of all) {

            const rect = el.getBoundingClientRect();

            if (
                rect.width < 180 ||
                rect.width > 700 ||
                rect.height < window.innerHeight * 0.65 ||
                rect.left > 8 ||
                rect.right < 180 ||
                rect.right > 700
            ) {
                continue;
            }

            const style = getComputedStyle(el);

            let score = 0;

            if (
                style.position === 'fixed' ||
                style.position === 'absolute'
            ) {
                score += 5;
            }

            if (rect.top <= 10) {
                score += 3;
            }

            if (rect.height >= window.innerHeight * 0.9) {
                score += 4;
            }

            // 左侧栏通常含有大量链接/按钮
            score += Math.min(
                el.querySelectorAll('a, button').length,
                20
            );

            if (score > bestScore) {
                bestScore = score;
                best = el;
            }
        }

        return best;
    }

    function findWidthTargets() {
        const leaf = findSidebar();
        if (!leaf) return [];

        const targets = [];
        for (let el = leaf; el && el !== document.body; el = el.parentElement) {
            const rect = el.getBoundingClientRect();
            if (rect.left > 12 || rect.width < 180 || rect.width > 700) break;
            targets.push(el);
        }
        const outer = targets[targets.length - 1];
        const outerRect = outer.getBoundingClientRect();
        for (const el of outer.querySelectorAll('*')) {
            const rect = el.getBoundingClientRect();
            if (
                rect.left <= 12 &&
                rect.width >= 180 &&
                rect.width <= outerRect.width + 1 &&
                rect.height >= window.innerHeight * 0.6 &&
                !targets.includes(el)
            ) {
                targets.push(el);
            }
        }
        targets.splice(targets.indexOf(outer), 1);
        targets.unshift(outer);
        return targets;
    }


    // ---------------------------------------------------------
    // 2. 设置侧栏宽度
    // ---------------------------------------------------------

    function setSidebarWidth(width) {

        width = Math.max(
            MIN_WIDTH,
            Math.min(MAX_WIDTH, width)
        );

        widthTargets = findWidthTargets();
        sidebar = widthTargets.length ? widthTargets[0] : null;

        // 尽可能覆盖新版/旧版 ChatGPT 的 CSS 变量
        document.documentElement.style.setProperty(
            '--sidebar-width',
            width + 'px',
            'important'
        );

        if (document.body) {
            document.body.style.setProperty(
                '--sidebar-width',
                width + 'px',
                'important'
            );
        }


        for (const target of widthTargets) {
            target.style.setProperty('--sidebar-width', width + 'px', 'important');
            target.style.setProperty('width', width + 'px', 'important');
            target.style.setProperty('min-width', width + 'px', 'important');
            target.style.setProperty('max-width', width + 'px', 'important');
            target.style.setProperty('flex-basis', width + 'px', 'important');
        }

        if (handle && sidebar) {
            handle.style.left = (sidebar.getBoundingClientRect().right - 4) + 'px';
        }
    }


    // ---------------------------------------------------------
    // 3. 让手柄始终贴着真正的侧栏右边缘
    // ---------------------------------------------------------

    function updateHandlePosition() {

        if (dragging) return;

        widthTargets = findWidthTargets();
        sidebar = widthTargets.length ? widthTargets[0] : null;

        if (!sidebar) {
            if (handle) {
                handle.style.display = 'none';
            }
            return;
        }

        const rect = sidebar.getBoundingClientRect();

        if (
            rect.width < 150 ||
            rect.right < 150
        ) {
            handle.style.display = 'none';
            return;
        }

        handle.style.display = 'block';

        // 如果用户以前保存过宽度，第一次找到侧栏时应用
        if (savedWidth !== null) setSidebarWidth(savedWidth);
        handle.style.left = (sidebar.getBoundingClientRect().right - 4) + 'px';
    }


    // ---------------------------------------------------------
    // 4. 创建拖拽手柄
    // ---------------------------------------------------------

    function createHandle() {

        const old = document.getElementById(
            'chatgpt-sidebar-resizer-v2'
        );

        if (old) {
            old.remove();
        }


        handle = document.createElement('div');

        handle.id = 'chatgpt-sidebar-resizer-v2';


        Object.assign(handle.style, {

            position: 'fixed',

            top: '0',

            bottom: '0',

            width: '8px',

            cursor: 'col-resize',

            zIndex: '2147483647',

            userSelect: 'none',

            // 平时显示一条很淡的竖线
            borderLeft: '2px solid rgba(120,120,120,0.22)',

            background: 'transparent',

            boxSizing: 'border-box'
        });


        // 鼠标放上去，让它明显一点
        handle.addEventListener('mouseenter', () => {

            if (!dragging) {

                handle.style.borderLeft =
                    '3px solid rgba(80,120,220,0.75)';

                handle.style.background =
                    'rgba(80,120,220,0.08)';
            }
        });


        handle.addEventListener('mouseleave', () => {

            if (!dragging) {

                handle.style.borderLeft =
                    '2px solid rgba(120,120,120,0.22)';

                handle.style.background =
                    'transparent';
            }
        });


        handle.addEventListener('mousedown', event => {

            if (event.button !== 0) return;

            dragging = true;

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            handle.style.borderLeft =
                '3px solid rgba(80,120,220,0.95)';

            event.preventDefault();
            event.stopPropagation();
        });


        document.addEventListener('mousemove', event => {

            if (!dragging) return;

            const width = event.clientX;

            setSidebarWidth(width);
        });


        document.addEventListener('mouseup', () => {

            if (!dragging) return;

            dragging = false;

            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            handle.style.borderLeft =
                '2px solid rgba(120,120,120,0.22)';

            handle.style.background =
                'transparent';


            const rect = sidebar
                ? sidebar.getBoundingClientRect()
                : null;

            if (rect) {

                const width = Math.round(rect.width);

                if (
                    width >= MIN_WIDTH &&
                    width <= MAX_WIDTH
                ) {

                    savedWidth = width;

                    localStorage.setItem(
                        STORAGE_KEY,
                        String(width)
                    );
                }
            }

            updateHandlePosition();
        });


        // 双击拖拽线，恢复 ChatGPT 当前默认宽度
        handle.addEventListener('dblclick', () => {

            localStorage.removeItem(STORAGE_KEY);

            savedWidth = null;

            location.reload();
        });


        document.body.appendChild(handle);

        updateHandlePosition();
    }


    // ---------------------------------------------------------
    // 5. 初始化
    // ---------------------------------------------------------

    function init() {

        if (!document.body) {

            setTimeout(init, 300);
            return;
        }

        createHandle();


        // ChatGPT 是单页应用，持续检查侧栏位置
        setInterval(() => {

            if (!handle || !document.contains(handle)) {
                createHandle();
                return;
            }

            updateHandlePosition();

        }, 800);
    }


    init();

})();
