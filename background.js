chrome.action.onClicked.addListener((tab) => {
    // Khi click icon, tiêm file edit-mode.js vào trang hiện tại
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['edit-mode.js']
    });
});