import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import FormData from 'form-data';
import AdmZip from 'adm-zip';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Extension Download Endpoint ---
app.get('/api/extension/download', (req, res) => {
  try {
    const zip = new AdmZip();
    zip.addLocalFolder(path.join(process.cwd(), 'extension_src'));
    
    const zipBuffer = zip.toBuffer();
    
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename=kiotviet-fb-extension.zip');
    res.set('Content-Length', zipBuffer.length.toString());
    
    res.send(zipBuffer);
  } catch (error) {
    console.error('Error creating zip:', error);
    res.status(500).json({ error: 'Failed to create extension zip' });
  }
});

// Helper to get KiotViet Token
async function getKiotVietToken(clientId: string, clientSecret: string) {
  const params = new URLSearchParams();
  params.append('scopes', 'PublicApi.Access');
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  const response = await axios.post('https://id.kiotviet.vn/connect/token', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data.access_token;
}

// API Routes
app.post('/api/ai/generate-content', async (req, res) => {
  try {
    const { productName, price, code, tone, painPoints, usps } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing GEMINI_API_KEY in environment' });
    }

    if (apiKey === 'MY_GEMINI_API_KEY' || apiKey.includes('TODO')) {
      return res.status(400).json({ 
        error: 'Invalid API Key', 
        message: 'Bạn đang sử dụng API Key mẫu. Vui lòng mở menu Settings (bánh răng) -> Secrets, tìm biến GEMINI_API_KEY và XÓA nó đi (để dùng key mặc định) hoặc thay bằng key thật của bạn.' 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Bạn là một chuyên gia Copywriter và Marketing thực chiến trên Facebook. Hãy viết một bài đăng bán hàng ĐỘC ĐÁO, GÂY TÒ MÒ và CHUẨN SEO cho sản phẩm sau:
- Tên sản phẩm: ${productName}
- Mã sản phẩm: ${code || 'Đang cập nhật'}
- Giá bán: ${price}
${usps ? `- Điểm nổi bật (USPs): ${usps}` : ''}
${painPoints ? `- Nỗi đau khách hàng giải quyết được: ${painPoints}` : ''}
- Giọng văn yêu cầu: ${tone || 'Hấp dẫn, thu hút'}

Yêu cầu BẮT BUỘC:
1. Tiêu đề (Hook): Phải thật giật tít, gây tò mò tột độ hoặc đánh trúng "nỗi đau" của khách hàng khiến họ phải dừng lại đọc tiếp. KHÔNG dùng những mẫu câu cũ rích.
2. Thân bài: Dựa vào tên sản phẩm và các thông tin cung cấp, hãy tự suy luận ra công dụng, điểm nổi bật và lợi ích tuyệt vời nhất của nó. Kể một câu chuyện ngắn, đưa ra một sự thật thú vị, hoặc tạo ra một lý do không thể chối từ để mua ngay.
3. Kích thích hành động (Call to Action): Tạo sự khan hiếm thực tế (ví dụ: "Chỉ còn đúng 5 suất", "Hàng vừa về đã vơi nửa kho"). Kêu gọi khách hàng INBOX hoặc COMMENT ngay.
4. Hashtag: 5-7 hashtag tối ưu tìm kiếm liên quan đến sản phẩm.
5. Trả về trực tiếp nội dung bài viết, tuyệt đối KHÔNG giải thích hay chào hỏi.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ content: response.text });
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate content', details: error.message });
  }
});

app.post('/api/kiotviet/verify', async (req, res) => {
  try {
    const { clientId, clientSecret, retailer } = req.body;
    if (!clientId || !clientSecret || !retailer) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin KiotViet' });
    }
    const token = await getKiotVietToken(clientId, clientSecret);
    await axios.get('https://public.kiotapi.com/products?pageSize=1', {
      headers: { 'Authorization': `Bearer ${token}`, 'Retailer': retailer }
    });
    res.json({ success: true, message: 'Kết nối KiotViet thành công!' });
  } catch (error: any) {
    res.status(400).json({ error: 'Kết nối KiotViet thất bại', details: error.response?.data || error.message });
  }
});

app.post('/api/facebook/verify', async (req, res) => {
  try {
    const { fbToken, fbPageId } = req.body;
    if (!fbToken || !fbPageId) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin Facebook' });
    }
    
    // Check who the token belongs to
    const meResponse = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${fbToken}`);
    const tokenOwnerId = meResponse.data.id;
    const tokenOwnerName = meResponse.data.name;

    if (tokenOwnerId !== fbPageId) {
      return res.status(400).json({ 
        error: 'Sai loại Token (Đang dùng User Token)', 
        details: `Token bạn nhập đang là của tài khoản cá nhân "${tokenOwnerName}". Để đăng bài, bạn PHẢI dùng Page Access Token. Hãy quay lại Graph API Explorer, ở mục "User or Page", bấm chọn đúng tên Fanpage của bạn để nó tạo ra một đoạn mã Token mới.` 
      });
    }

    const response = await axios.get(`https://graph.facebook.com/v19.0/${fbPageId}?access_token=${fbToken}`);
    res.json({ success: true, name: response.data.name, message: `Kết nối thành công tới trang: ${response.data.name}` });
  } catch (error: any) {
    const fbError = error.response?.data?.error;
    const errorMessage = fbError ? `${fbError.message} (Type: ${fbError.type})` : error.message;
    res.status(400).json({ error: 'Kết nối Facebook thất bại', details: errorMessage });
  }
});

app.post('/api/facebook/refresh-token', async (req, res) => {
  try {
    const { fbToken, fbAppId, fbAppSecret } = req.body;
    if (!fbToken || !fbAppId || !fbAppSecret) {
      return res.status(400).json({ error: 'Thiếu thông tin App ID hoặc App Secret' });
    }
    const response = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: fbAppId,
        client_secret: fbAppSecret,
        fb_exchange_token: fbToken
      }
    });
    res.json({ success: true, access_token: response.data.access_token });
  } catch (error: any) {
    const fbError = error.response?.data?.error;
    const errorMessage = fbError ? `${fbError.message} (Type: ${fbError.type})` : error.message;
    res.status(400).json({ error: 'Không thể gia hạn Token', details: errorMessage });
  }
});

app.get('/api/kiotviet/products', async (req, res) => {
  try {
    const clientId = req.headers['x-kiotviet-client-id'] as string || process.env.KIOTVIET_CLIENT_ID;
    const clientSecret = req.headers['x-kiotviet-client-secret'] as string || process.env.KIOTVIET_CLIENT_SECRET;
    const retailer = req.headers['x-kiotviet-retailer'] as string || process.env.KIOTVIET_RETAILER;

    if (!clientId || !clientSecret || !retailer) {
      return res.status(400).json({ error: 'Vui lòng cấu hình API KiotViet trong phần Cài đặt (Settings).' });
    }

    const token = await getKiotVietToken(clientId, clientSecret);
    
    // Fetch products from KiotViet
    const response = await axios.get('https://public.kiotapi.com/products', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Retailer': retailer
      },
      params: {
        pageSize: 50,
        includeInventory: true,
        orderBy: 'createdDate',
        orderDirection: 'Desc'
      }
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('KiotViet API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch products from KiotViet', details: error.response?.data || error.message });
  }
});

app.post('/api/facebook/post', async (req, res) => {
  try {
    const fbToken = req.headers['x-fb-page-access-token'] as string || process.env.FB_PAGE_ACCESS_TOKEN;
    const fbPageId = req.headers['x-fb-page-id'] as string || process.env.FB_PAGE_ID;

    if (!fbToken || !fbPageId) {
      return res.status(400).json({ error: 'Vui lòng cấu hình API Facebook trong phần Cài đặt (Settings).' });
    }

    const { message, link, images, scheduledTime } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const isScheduled = !!scheduledTime;
    const scheduledUnix = isScheduled ? Math.floor(new Date(scheduledTime).getTime() / 1000) : undefined;

    const uploadImage = async (img: {url?: string, base64?: string}, published: boolean = false, scheduledUnix?: number) => {
      let buffer: Buffer;
      let contentType = 'image/jpeg';

      if (img.base64) {
        const base64Data = img.base64.replace(/^data:image\/\w+;base64,/, "");
        buffer = Buffer.from(base64Data, 'base64');
      } else if (img.url) {
        // Fetch image to bypass Facebook crawler issues with KiotViet URLs
        const imageResponse = await axios.get(img.url, { responseType: 'arraybuffer' });
        buffer = Buffer.from(imageResponse.data, 'binary');
        contentType = imageResponse.headers['content-type'] || 'image/jpeg';
      } else {
        return null;
      }

      const form = new FormData();
      form.append('access_token', fbToken);
      
      if (scheduledUnix && images.length === 1) {
        form.append('published', 'false');
        form.append('scheduled_publish_time', scheduledUnix.toString());
        if (message) form.append('caption', message);
      } else {
        form.append('published', published ? 'true' : 'false');
        if (published && message && images.length === 1) form.append('caption', message);
      }

      form.append('source', buffer, { filename: 'image.jpg', contentType });
      
      const res = await axios.post(`https://graph.facebook.com/v19.0/${fbPageId}/photos`, form, { headers: form.getHeaders() });
      return res.data.id;
    };

    let postId;

    // If there are multiple images
    if (images && images.length > 1 && !link) {
      const attached_media = [];
      for (const img of images) {
        const photoId = await uploadImage(img, false);
        if (photoId) attached_media.push({ media_fbid: photoId });
      }
      
      const payload: any = { message, attached_media, access_token: fbToken };
      if (isScheduled) {
        payload.published = false;
        payload.scheduled_publish_time = scheduledUnix;
      }
      const response = await axios.post(`https://graph.facebook.com/v19.0/${fbPageId}/feed`, payload);
      postId = response.data.id;
    } 
    // If there's exactly one image
    else if (images && images.length === 1 && !link) {
      postId = await uploadImage(images[0], !isScheduled, isScheduled ? scheduledUnix : undefined);
    }
    // If no images or has link
    else {
      const payload: any = { message, access_token: fbToken };
      if (link) payload.link = link;
      if (isScheduled) {
        payload.published = false;
        payload.scheduled_publish_time = scheduledUnix;
      }
      const response = await axios.post(`https://graph.facebook.com/v19.0/${fbPageId}/feed`, payload);
      postId = response.data.id;
    }

    res.json({ success: true, id: postId });
  } catch (error: any) {
    const fbError = error.response?.data?.error;
    let errorMessage = error.message;
    
    if (fbError) {
      if (fbError.error_user_title || fbError.error_user_msg) {
        errorMessage = `${fbError.error_user_title ? fbError.error_user_title + ': ' : ''}${fbError.error_user_msg || fbError.message} (Subcode: ${fbError.error_subcode})`;
      } else {
        errorMessage = `${fbError.message} (Type: ${fbError.type}, Code: ${fbError.code})`;
      }
    }
      
    console.error('Facebook API Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: `Lỗi Facebook API: ${errorMessage}`, 
      details: error.response?.data || error.message 
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
