import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Add a request interceptor to include the token
api.interceptors.request.use(async (config) => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  1 وضع التجربة (Demo Mode) للمحاكاة بدون باكند
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (process.env.FIREBASE_API_KEY?.includes('Dummy')) {
    const MOCK_INSTRUCTORS_KEY = 'mock_instructors';
    
    // محاكاة جلب قائمة   الأساتذة
    if (config.url === '/instructors' && config.method === 'get') {
      const stored = localStorage.getItem(MOCK_INSTRUCTORS_KEY);
      const data = stored ? JSON.parse(stored) : [];
      config.adapter = async () => ({
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }

    // محاكاة إعادة تعيين كلمة المرور
    if (config.url?.includes('/reset-password') && config.method === 'post') {
      // استخراج الماتريكول بشكل أكثر دقة من الرابط
      const match = config.url.match(/\/instructors\/([^/]+)\/reset-password/);
      const matricule = match ? match[1] : null;
      const  { password } = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      
      const stored = localStorage.getItem(MOCK_INSTRUCTORS_KEY);
      if (stored) {
        const list = JSON.parse(stored);
        const index = list.findIndex((p: any) => p.matricule === matricule);
        if (index !== -1) {
          list[index].password = password;
          localStorage.setItem(MOCK_INSTRUCTORS_KEY, JSON.stringify(list));
        }
      }

      config.adapter = async () => ({
        data: { message: 'Password reset successfully (Mocked)' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }
  }

  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
