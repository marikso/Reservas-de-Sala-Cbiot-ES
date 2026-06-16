import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import PortalGate from './PortalGate';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>

      <Routes>
        <Route path="/" element={<PortalGate />} />
        <Route path="/ReservaDeSalas" element={<App />} />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);