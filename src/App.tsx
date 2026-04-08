import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Facebook, RefreshCw, Send, Image as ImageIcon, AlertCircle, CheckCircle2, Sparkles, Settings, X, Upload, Calendar, Link as LinkIcon, ChevronLeft, ChevronRight, Filter, History, ExternalLink, Edit2, MonitorPlay, Download } from 'lucide-react';
import { Toaster, toast } from 'sonner';

interface Product {
  id: number;
  code: string;
  name: string;
  fullName: string;
  basePrice: number;
  images?: string[];
  inventories?: { branchId: number; onHand: number }[];
}

interface PostImage {
  id: string;
  url?: string;
  base64?: string;
}

interface PostHistoryItem {
  id: string;
  productName: string;
  date: string;
  link: string;
}

export default function App() {
  // --- Settings State ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    kvClientId: localStorage.getItem('kvClientId') || '',
    kvClientSecret: localStorage.getItem('kvClientSecret') || '',
    kvRetailer: localStorage.getItem('kvRetailer') || '',
    fbToken: localStorage.getItem('fbToken') || '',
    fbPageId: localStorage.getItem('fbPageId') || '',
    fbAppId: localStorage.getItem('fbAppId') || '',
    fbAppSecret: localStorage.getItem('fbAppSecret') || '',
  });
  const [testingKV, setTestingKV] = useState(false);
  const [testingFB, setTestingFB] = useState(false);
  
  const [postHistory, setPostHistory] = useState<PostHistoryItem[]>(() => {
    const saved = localStorage.getItem('postHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [extensionReady, setExtensionReady] = useState(false);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "KV_FB_PONG") {
        setExtensionReady(true);
      }
    };
    window.addEventListener("message", handleMessage);
    
    const pingInterval = setInterval(() => {
      window.postMessage({ type: "KV_FB_PING" }, "*");
    }, 1500);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(pingInterval);
    };
  }, []);

  const testKV = async () => {
    setTestingKV(true);
    try {
      const res = await fetch('/api/kiotviet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: settings.kvClientId, clientSecret: settings.kvClientSecret, retailer: settings.kvRetailer })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi kết nối');
      toast.success(data.message || 'Kết nối KiotViet thành công!');
    } catch (err: any) {
      toast.error(`KiotViet: ${err.message}`);
    } finally {
      setTestingKV(false);
    }
  };

  const testFB = async () => {
    setTestingFB(true);
    try {
      const res = await fetch('/api/facebook/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbToken: settings.fbToken, fbPageId: settings.fbPageId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Lỗi kết nối');
      toast.success(data.message || 'Kết nối Facebook thành công!');
    } catch (err: any) {
      toast.error(`Facebook: ${err.message}`);
    } finally {
      setTestingFB(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('kvClientId', settings.kvClientId);
    localStorage.setItem('kvClientSecret', settings.kvClientSecret);
    localStorage.setItem('kvRetailer', settings.kvRetailer);
    localStorage.setItem('fbToken', settings.fbToken);
    localStorage.setItem('fbPageId', settings.fbPageId);
    localStorage.setItem('fbAppId', settings.fbAppId);
    localStorage.setItem('fbAppSecret', settings.fbAppSecret);
    setSettingsOpen(false);
    toast.success('Đã lưu cấu hình thành công!');
  };

  const getHeaders = () => ({
    'x-kiotviet-client-id': settings.kvClientId,
    'x-kiotviet-client-secret': settings.kvClientSecret,
    'x-kiotviet-retailer': settings.kvRetailer,
    'x-fb-page-access-token': settings.fbToken,
    'x-fb-page-id': settings.fbPageId,
  });

  // --- Products State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState('all');

  const fetchProducts = async () => {
    if (!settings.kvClientId || !settings.kvClientSecret || !settings.kvRetailer) {
      toast.error('Vui lòng cấu hình KiotViet API trước khi tải sản phẩm.');
      setSettingsOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/kiotviet/products', { headers: getHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch products');
      setProducts(data.data || []);
      toast.success('Tải sản phẩm thành công!');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const stock = p.inventories?.reduce((sum, inv) => sum + inv.onHand, 0) || 0;
    if (inventoryFilter === 'inStock') return stock > 0;
    if (inventoryFilter === 'outOfStock') return stock <= 0;
    return true;
  });

  // --- Image Viewer Modal ---
  const [viewerImages, setViewerImages] = useState<string[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openViewer = (images: string[], index: number) => {
    setViewerImages(images);
    setViewerIndex(index);
  };

  // --- Post Modal State ---
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [postMessage, setPostMessage] = useState('');
  const [postImages, setPostImages] = useState<PostImage[]>([]);
  const [postLink, setPostLink] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  
  const [aiTone, setAiTone] = useState('Hấp dẫn, thu hút');
  const [aiPainPoints, setAiPainPoints] = useState('');
  const [aiUsps, setAiUsps] = useState('');
  const [generatingContent, setGeneratingContent] = useState(false);
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [posting, setPosting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPostModal = (product: Product) => {
    setSelectedProduct(product);
    setEditName(product.fullName);
    setEditPrice(product.basePrice);
    setPostImages((product.images || []).map(url => ({ id: Math.random().toString(), url })));
    setPostLink('');
    setIsScheduling(false);
    setScheduleTime('');
    setAiTone('Hấp dẫn, thu hút');
    setAiPainPoints('');
    setAiUsps('');
    setPostMessage('Đang nhờ AI viết bài siêu cuốn... ✍️✨');
    generateAIContent(product.fullName, product.basePrice, product.code);
  };

  const generateAIContent = async (name = editName, price = editPrice, code = selectedProduct?.code) => {
    if (!name) return;
    setGeneratingContent(true);
    try {
      const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: name, 
          price: formattedPrice,
          code,
          tone: aiTone,
          painPoints: aiPainPoints,
          usps: aiUsps
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Failed to generate content');
      
      setPostMessage(data.content);
      toast.success('Đã tạo nội dung AI thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo nội dung AI');
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostImages(prev => [...prev, { id: Math.random().toString(), base64: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    setPostImages(prev => prev.filter(img => img.id !== id));
  };

  const executePost = async (tokenToUse: string) => {
    const response = await fetch('/api/facebook/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kiotviet-client-id': settings.kvClientId,
        'x-kiotviet-client-secret': settings.kvClientSecret,
        'x-kiotviet-retailer': settings.kvRetailer,
        'x-fb-page-access-token': tokenToUse,
        'x-fb-page-id': settings.fbPageId,
      },
      body: JSON.stringify({
        message: postMessage,
        link: postLink || undefined,
        images: postImages,
        scheduledTime: isScheduling && scheduleTime ? scheduleTime : undefined
      }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to post to Facebook');
    return data.id;
  };

  const refreshToken = async () => {
    const res = await fetch('/api/facebook/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fbToken: settings.fbToken, fbAppId: settings.fbAppId, fbAppSecret: settings.fbAppSecret })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi gia hạn');
    const newToken = data.access_token;
    setSettings(s => ({ ...s, fbToken: newToken }));
    localStorage.setItem('fbToken', newToken);
    return newToken;
  };

  const handlePostSuccess = (postId: string) => {
    const postUrl = postId.includes('_') 
      ? `https://facebook.com/${postId.split('_')[0]}/posts/${postId.split('_')[1]}`
      : `https://facebook.com/${postId}`;

    const newHistoryItem = {
      id: Math.random().toString(),
      productName: selectedProduct?.fullName || 'Sản phẩm',
      date: new Date().toISOString(),
      link: postUrl
    };

    setPostHistory(prev => {
      const updated = [newHistoryItem, ...prev];
      localStorage.setItem('postHistory', JSON.stringify(updated));
      return updated;
    });

    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-medium">{isScheduling ? 'Đã lên lịch bài viết!' : 'Đã đăng bài thành công!'}</span>
        <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
          Xem bài viết trên Facebook
        </a>
      </div>,
      { duration: 5000 }
    );
    
    setShowConfirm(false);
    setSelectedProduct(null);
  };

  const handlePostViaExtension = () => {
    if (!postMessage) {
      toast.error('Vui lòng nhập nội dung bài viết');
      return;
    }
    
    window.postMessage({
      type: "KV_FB_POST",
      payload: {
        message: postMessage,
        images: postImages
      }
    }, "*");
    
    toast.success('Đã gửi lệnh sang Extension! Vui lòng kiểm tra tab Facebook mới mở.');
    setShowConfirm(false);
  };

  const handlePostConfirm = async () => {
    if (!settings.fbToken || !settings.fbPageId) {
      toast.error('Vui lòng cấu hình Facebook API trước khi đăng bài.');
      setShowConfirm(false);
      setSettingsOpen(true);
      return;
    }

    setPosting(true);
    try {
      // Pre-check token validity
      const verifyRes = await fetch('/api/facebook/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbToken: settings.fbToken, fbPageId: settings.fbPageId })
      });
      
      let tokenToUse = settings.fbToken;

      if (!verifyRes.ok) {
        if (settings.fbAppId && settings.fbAppSecret) {
          toast.info('Token hết hạn, đang tự động gia hạn...');
          tokenToUse = await refreshToken();
        } else {
          const verifyData = await verifyRes.json();
          throw new Error(verifyData.details || verifyData.error || 'Token Facebook không hợp lệ hoặc đã hết hạn.');
        }
      }

      const postId = await executePost(tokenToUse);
      handlePostSuccess(postId);
    } catch (err: any) {
      toast.error(err.message);
      setShowConfirm(false);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-12">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight hidden sm:block">KiotViet to FB Sync</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-md p-1">
              <Filter className="w-4 h-4 text-gray-500 ml-2" />
              <select 
                value={inventoryFilter} 
                onChange={e => setInventoryFilter(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 py-1 pl-2 pr-2 cursor-pointer"
              >
                <option value="all">Tất cả sản phẩm</option>
                <option value="inStock">Còn hàng</option>
                <option value="outOfStock">Hết hàng</option>
              </select>
              {inventoryFilter !== 'all' && (
                <button 
                  onClick={() => setInventoryFilter('all')}
                  className="p-1 hover:bg-gray-200 rounded-md text-gray-500 hover:text-red-500 transition-colors"
                  title="Xóa bộ lọc"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setHistoryOpen(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
              title="Lịch sử đăng bài"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
              title="Cài đặt API"
            >
              <Settings className="w-5 h-5" />
            </button>
            <a
              href="/api/extension/download"
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors hidden sm:flex items-center gap-1.5 text-sm font-medium"
              title="Tải Chrome Extension"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Tải Extension</span>
            </a>
            <button
              onClick={fetchProducts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Đang tải...' : 'Tải sản phẩm'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Lỗi kết nối</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && products.length === 0 && !error && (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-xl shadow-sm">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900">Chưa có sản phẩm nào</h2>
            <p className="text-gray-500 mt-1">Vui lòng cấu hình API và nhấn "Tải sản phẩm".</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const stock = product.inventories?.reduce((sum, inv) => sum + inv.onHand, 0) || 0;
            return (
              <div key={product.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:ring-2 hover:ring-blue-400 transition-all flex flex-col group relative">
                <div className="aspect-square bg-gray-100 relative flex items-center justify-center overflow-hidden cursor-pointer group/image" onClick={() => product.images?.length ? openViewer(product.images, 0) : null}>
                  {product.images && product.images.length > 0 ? (
                    <>
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover/image:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                      {product.images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> +{product.images.length - 1}
                        </div>
                      )}
                    </>
                  ) : (
                    <ImageIcon className="w-10 h-10 text-gray-300" />
                  )}
                  <div className={`absolute top-2 left-2 text-xs font-medium px-2 py-1 rounded-md backdrop-blur-sm ${stock > 0 ? 'bg-green-100/90 text-green-700' : 'bg-red-100/90 text-red-700'}`}>
                    Tồn: {stock}
                  </div>
                  
                  {/* Edit Button Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openPostModal(product); }}
                      className="flex items-center gap-2 bg-white text-gray-900 px-4 py-2 rounded-lg font-medium text-sm transform translate-y-4 group-hover/image:translate-y-0 transition-all shadow-lg hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Edit2 className="w-4 h-4" /> Soạn bài
                    </button>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <div className="text-xs text-gray-500 mb-1 font-mono">{product.code}</div>
                  <h3 className="font-medium text-gray-900 line-clamp-2 mb-2 flex-grow" title={product.fullName}>
                    {product.fullName}
                  </h3>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                    <span className="font-semibold text-blue-600">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.basePrice)}
                    </span>
                    <button
                      onClick={() => openPostModal(product)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors"
                    >
                      <Facebook className="w-4 h-4" />
                      Đăng FB
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" /> Cấu hình API
              </h2>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" /> KiotViet API
                  </h3>
                  <button type="button" onClick={testKV} disabled={testingKV} className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50">
                    {testingKV ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
                    <input type="text" value={settings.kvClientId} onChange={e => setSettings({ ...settings, kvClientId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
                    <input type="password" value={settings.kvClientSecret} onChange={e => setSettings({ ...settings, kvClientSecret: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Retailer (Tên gian hàng)</label>
                    <input type="text" value={settings.kvRetailer} onChange={e => setSettings({ ...settings, kvRetailer: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-blue-600" /> Facebook Graph API
                  </h3>
                  <button type="button" onClick={testFB} disabled={testingFB} className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50">
                    {testingFB ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Page Access Token</label>
                    <input type="password" value={settings.fbToken} onChange={e => setSettings({ ...settings, fbToken: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Page ID</label>
                    <input type="text" value={settings.fbPageId} onChange={e => setSettings({ ...settings, fbPageId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">App ID (Tùy chọn - Dùng để tự động gia hạn Token)</label>
                    <input type="text" value={settings.fbAppId} onChange={e => setSettings({ ...settings, fbAppId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">App Secret (Tùy chọn)</label>
                    <input type="password" value={settings.fbAppSecret} onChange={e => setSettings({ ...settings, fbAppSecret: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Hủy</button>
              <button onClick={saveSettings} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Lưu cấu hình</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewerImages && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]">
          <button onClick={() => setViewerImages(null)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2"><X className="w-8 h-8" /></button>
          
          {viewerImages.length > 1 && (
            <button onClick={() => setViewerIndex((prev) => (prev === 0 ? viewerImages.length - 1 : prev - 1))} className="absolute left-4 text-white/70 hover:text-white p-2">
              <ChevronLeft className="w-10 h-10" />
            </button>
          )}
          
          <img src={viewerImages[viewerIndex]} alt="Preview" className="max-w-full max-h-[90vh] object-contain" referrerPolicy="no-referrer" />
          
          {viewerImages.length > 1 && (
            <button onClick={() => setViewerIndex((prev) => (prev === viewerImages.length - 1 ? 0 : prev + 1))} className="absolute right-4 text-white/70 hover:text-white p-2">
              <ChevronRight className="w-10 h-10" />
            </button>
          )}
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
            {viewerIndex + 1} / {viewerImages.length}
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" /> Lịch sử đăng bài
              </h2>
              <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-grow">
              {postHistory.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  Chưa có bài đăng nào trong lịch sử.
                </div>
              ) : (
                <div className="space-y-4">
                  {postHistory.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                      <div>
                        <h4 className="font-medium text-gray-900 line-clamp-1">{item.productName}</h4>
                        <p className="text-xs text-gray-500 mt-1">{new Date(item.date).toLocaleString('vi-VN')}</p>
                      </div>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                        <ExternalLink className="w-4 h-4" /> Xem bài
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Facebook className="w-5 h-5 text-blue-600" /> Soạn bài đăng Facebook
              </h2>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Column: Product Info & AI */}
                <div className="flex flex-col gap-6">
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                    <h3 className="font-semibold text-blue-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                      <ShoppingBag className="w-4 h-4" /> Thông tin sản phẩm
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tên sản phẩm</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Giá bán (VNĐ)</label>
                      <input type="number" value={editPrice} onChange={e => setEditPrice(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>

                  <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-4">
                    <h3 className="font-semibold text-purple-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" /> Cấu hình AI Content
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Giọng văn</label>
                      <select value={aiTone} onChange={e => setAiTone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white">
                        <option value="Hấp dẫn, thu hút">Hấp dẫn, thu hút</option>
                        <option value="Khẩn cấp, khan hiếm">Khẩn cấp, khan hiếm</option>
                        <option value="Hài hước, bắt trend">Hài hước, bắt trend</option>
                        <option value="Chuyên gia, đáng tin cậy">Chuyên gia, đáng tin cậy</option>
                        <option value="Kể chuyện (Storytelling)">Kể chuyện (Storytelling)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Điểm nổi bật (USPs)</label>
                      <input type="text" placeholder="Ví dụ: Chất liệu cao cấp, bảo hành 12 tháng..." value={aiUsps} onChange={e => setAiUsps(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nỗi đau khách hàng</label>
                      <input type="text" placeholder="Ví dụ: Hay bị đau lưng, tốn thời gian..." value={aiPainPoints} onChange={e => setAiPainPoints(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                    </div>
                    <button
                      type="button"
                      onClick={() => generateAIContent()}
                      disabled={generatingContent}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generatingContent ? 'Đang viết bài...' : 'Viết lại bằng AI'}
                    </button>
                  </div>
                </div>

                {/* Right Column: Post Content */}
                <div className="flex flex-col gap-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="block text-sm font-medium text-gray-700">Nội dung bài viết</label>
                      <span className={`text-xs font-medium ${postMessage.length > 1900 ? 'text-red-500' : 'text-gray-500'}`}>
                        {postMessage.length}/2000
                      </span>
                    </div>
                    <textarea
                      value={postMessage}
                      onChange={(e) => setPostMessage(e.target.value)}
                      maxLength={2000}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                      placeholder="Nhập nội dung bài viết..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Hình ảnh đính kèm
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {postImages.map((img) => (
                        <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                          <img src={img.base64 || img.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => removeImage(img.id)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors">
                        <Upload className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium">Tải ảnh lên</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} ref={fileInputRef} />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" /> Link đính kèm
                      </label>
                      <input 
                        type="url" 
                        placeholder="https://..." 
                        value={postLink} 
                        onChange={e => setPostLink(e.target.value)} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Lên lịch đăng
                      </label>
                      <div className="flex items-center gap-2 h-[38px]">
                        <input 
                          type="checkbox" 
                          id="schedule" 
                          checked={isScheduling} 
                          onChange={e => setIsScheduling(e.target.checked)} 
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <input 
                          type="datetime-local" 
                          disabled={!isScheduling}
                          value={scheduleTime}
                          onChange={e => setScheduleTime(e.target.value)}
                          className="flex-grow px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setSelectedProduct(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Hủy</button>
              <button onClick={() => setShowConfirm(true)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Send className="w-4 h-4" /> Đăng bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Facebook className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận đăng bài</h3>
            <p className="text-sm text-gray-500 mb-6">
              {isScheduling 
                ? `Bài viết sẽ được lên lịch đăng vào ${new Date(scheduleTime).toLocaleString('vi-VN')}. Bạn có chắc chắn không?` 
                : 'Bài viết sẽ được đăng ngay lập tức lên Fanpage của bạn. Bạn có chắc chắn không?'}
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} disabled={posting} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                  Hủy
                </button>
                <button onClick={handlePostConfirm} disabled={posting} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {posting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {posting ? 'Đang xử lý...' : 'Đăng qua API'}
                </button>
              </div>
              <button onClick={handlePostViaExtension} disabled={posting || !extensionReady} className={`w-full px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${extensionReady ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}>
                <MonitorPlay className="w-4 h-4" />
                {extensionReady ? 'Đăng tự động qua Extension (Via)' : 'Chưa kết nối Extension (Cần F5 lại trang)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
