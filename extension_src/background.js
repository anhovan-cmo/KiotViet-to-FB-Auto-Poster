chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_posting") {
    const payload = request.payload;
    
    // Lưu dữ liệu vào storage
    chrome.storage.local.set({ pendingPost: payload }, () => {
      // Mở tab Facebook mới
      chrome.tabs.create({ url: "https://www.facebook.com/" });
    });
  }
});
