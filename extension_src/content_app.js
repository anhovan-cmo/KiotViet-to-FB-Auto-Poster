// Lắng nghe tin nhắn từ Web App (React)
window.addEventListener("message", (event) => {
  // Chỉ nhận tin nhắn từ chính trang web này
  if (event.source !== window) return;

  if (event.data.type === "KV_FB_PING") {
    window.postMessage({ type: "KV_FB_PONG" }, "*");
    return;
  }

  if (event.data.type && event.data.type === "KV_FB_POST") {
    console.log("Extension nhận được lệnh đăng bài từ Web App:", event.data.payload);
    
    // Gửi lệnh sang background.js để mở tab Facebook
    chrome.runtime.sendMessage({
      action: "start_posting",
      payload: event.data.payload
    });
  }
});
