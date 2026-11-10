importScripts("collector.js");
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const url = new URL(tab.url || "");
    if (url.origin !== "https://www.zhihu.com" ||
        !/^\/question\/\d+(?:\/answer\/\d+)?\/?$/.test(url.pathname)) {
      await chrome.action.setBadgeText({ tabId: tab.id, text: "页面不符" });
      await chrome.action.setTitle({ tabId: tab.id, title: "请先打开一个知乎问题或回答，再选择扫描范围" });
      return;
    }
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    const target = url.pathname.match(/^\/question\/(\d+)(?:\/answer\/(\d+))?\/?$/);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: aiOutpostReadOnlyExport,
      args: [{showMenu: true,
        expectedQuestionId: target[1], expectedAnswerId: target[2] || null}]
    });
  } catch (error) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "失败" }).catch(() => {});
    await chrome.action.setTitle({ tabId: tab.id, title: "导出未启动或已中断，请刷新目标页后检查扩展状态；不自动重试" }).catch(() => {});
    console.error("本机导出未启动或中断；不记录页面或底层异常原文");
  }
});
