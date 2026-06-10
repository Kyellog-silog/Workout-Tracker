/**
 * Application entry point.
 * Mounts the root React component into the DOM.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ConfirmProvider } from './components/ConfirmDialog.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </React.StrictMode>,
)
