import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

document.documentElement.setAttribute("translate", "no");
document.documentElement.classList.add("notranslate");
document.body.setAttribute("translate", "no");
document.body.classList.add("notranslate");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
