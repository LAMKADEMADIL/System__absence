import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);

// calling IPC exposed from preload script
if (window.electron) {
  // Electron bridge active
} else {
  console.log('Running in browser mode: Electron APIs are not available.');
}
