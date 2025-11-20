import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/custom-dropdowns.css'

// Silence verbose emoji logs in production unless explicitly enabled
if (import.meta.env.PROD && import.meta.env.VITE_VERBOSE_LOGS !== 'true') {
  const originalLog = console.log;
  console.log = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && /^(🔍|📊|🔄|✅|🔌|🔵|🏥|📋|⚠️|💰|🕐|🚪|👥|🔎)/.test(first)) {
      return; // skip verbose logs
    }
    originalLog(...args);
  };
  const originalDebug = console.debug;
  console.debug = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && /^(🔍|📊|🔄|✅|🔌|🔵|🏥|📋|⚠️|💰|🕐|🚪|👥|🔎)/.test(first)) {
      return;
    }
    originalDebug(...args);
  };
  const originalInfo = console.info;
  console.info = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && /^(🔍|📊|🔄|✅|🔌|🔵|🏥|📋|⚠️|💰|🕐|🚪|👥|🔎)/.test(first)) {
      return;
    }
    originalInfo(...args);
  };
}

// Assicurati che il DOM sia pronto prima di montare l'app
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('❌ Root element not found. Make sure the HTML has a <div id="root"></div> element.');
}
