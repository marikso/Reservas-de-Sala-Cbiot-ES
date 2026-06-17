import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import LoginPage from './LoginPage';
import './styles.css';

// Ponto de entrada do React. O roteamento tem duas rotas:
// "/" → PortalGate captura o ?token= vindo do Portal ou redireciona para login.
// "/ReservaDeSalas" → App principal, acessível somente após autenticação.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/ReservaDeSalas" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);