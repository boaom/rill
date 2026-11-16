import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installRuntimeErrorTracking } from './runtime';
import './styles/tokens.css';
import './styles/base.css';
import './styles/card.css';
import './styles/detail.css';
import './styles/compose.css';
import './styles/profile.css';
import './styles/feedback.css';

installRuntimeErrorTracking();

const container = document.getElementById('root');
if (!container) {
  throw new Error('缺少 #root 挂载点');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);