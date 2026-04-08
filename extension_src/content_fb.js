// Kiểm tra xem có bài đăng nào đang chờ xử lý không
chrome.storage.local.get(['pendingPost'], async (result) => {
  if (result.pendingPost) {
    const payload = result.pendingPost;
    // Xóa ngay lập tức để tránh đăng lại khi F5
    chrome.storage.local.remove(['pendingPost']);
    
    await startAutomation(payload);
  }
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function startAutomation(payload) {
  console.log("Bắt đầu tự động đăng bài...", payload);
  await sleep(3000); // Chờ Facebook tải xong giao diện
  
  // 1. Tìm ô "Bạn đang nghĩ gì?"
  let postBox = Array.from(document.querySelectorAll('div[role="button"]')).find(el => 
    el.textContent.includes('Bạn đang nghĩ gì') || 
    el.textContent.includes("What's on your mind") ||
    el.textContent.includes("Viết bài")
  );

  if (!postBox) {
    // Thử tìm theo thẻ span bên trong
    const spans = Array.from(document.querySelectorAll('span')).filter(s => 
      s.textContent.includes('Bạn đang nghĩ gì') || 
      s.textContent.includes("What's on your mind")
    );
    if (spans.length > 0) postBox = spans[0].closest('div[role="button"]');
  }

  if (postBox) {
    postBox.click();
    await sleep(3000); // Chờ modal mở lên
    
    // 2. Tìm ô nhập text
    const textBox = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (textBox) {
      textBox.focus();
      // Dán nội dung
      document.execCommand('insertText', false, payload.message);
      await sleep(2000);
      
      // 3. Xử lý ảnh
      if (payload.images && payload.images.length > 0) {
        // Tìm nút Thêm ảnh/video
        const photoBtn = Array.from(document.querySelectorAll('div[role="button"]')).find(el => 
          el.getAttribute('aria-label') === 'Ảnh/video' || 
          el.getAttribute('aria-label') === 'Photo/video'
        );
        
        if (photoBtn) {
          photoBtn.click();
          await sleep(2000);
        }

        const fileInput = document.querySelector('input[type="file"][accept^="image"]');
        if (fileInput) {
          const dataTransfer = new DataTransfer();
          for (const img of payload.images) {
            try {
              // Tải ảnh từ URL về thành File object
              const res = await fetch(img.url);
              const blob = await res.blob();
              const file = new File([blob], "image.jpg", { type: blob.type });
              dataTransfer.items.add(file);
            } catch (e) {
              console.error("Lỗi tải ảnh:", e);
            }
          }
          // Gắn file vào input và trigger event
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(3000); // Chờ Facebook preview ảnh
        } else {
          console.log("Không tìm thấy input tải ảnh.");
        }
      }
      
      alert("Extension đã điền xong nội dung! Vui lòng kiểm tra lại và bấm Đăng.");
    } else {
      alert("Không tìm thấy ô nhập nội dung.");
    }
  } else {
    alert("Không tìm thấy nút tạo bài viết. Vui lòng đứng ở trang chủ hoặc trang cá nhân.");
  }
}
