// Background script for WhatsApp Number Checker
// Opens the sidepanel when extension icon is clicked

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

console.log("Background script loaded");