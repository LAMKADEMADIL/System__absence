import axios from 'axios';

// Connect to Laravel running on localhost. 
// Note: Android emulator usually connects to 10.0.2.2 instead of 127.0.0.1
// but for physical devices on same network it should be IP address of PC.
// Since the user is likely running it locally on the desktop/emulator, we'll try 127.0.0.1 or 10.0.2.2.
import { Platform } from 'react-native';

const BASE_URL = Platform.OS === 'web' || Platform.OS === 'ios' ? 'http://127.0.0.1:8000/api' : (Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : 'http://192.168.11.107:8000/api');

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export default api;
