import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registrar Service Worker para habilitar la instalación PWA y funcionamiento offline
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Nivia PWA Service Worker registrado con éxito:', registration.scope);
      })
      .catch((error) => {
        console.error('Error al registrar Service Worker en Nivia PWA:', error);
      });
  });
}