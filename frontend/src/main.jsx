import React from 'react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import Historial from './pages/Historial.jsx';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import Reportes from './pages/Reportes.jsx';
import Seguimiento from './pages/Seguimiento.jsx';
import './styles.css';

const navItems = [
  { id: 'login', label: 'Login', symbol: 'IN', component: Login },
  { id: 'registro', label: 'Registro', symbol: 'RG', component: Registro },
  { id: 'historial', label: 'Historial', symbol: 'HS', component: Historial },
  { id: 'seguimiento', label: 'Seguimiento', symbol: 'SG', component: Seguimiento },
  { id: 'reportes', label: 'Reportes', symbol: 'RP', component: Reportes }
];

function AppShell() {
  const [activePage, setActivePage] = useState('login');
  const CurrentPage = navItems.find((item) => item.id === activePage)?.component ?? Login;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">E</span>
          <div>
            <strong>EPROS</strong>
            <small>Gestion de incapacidades</small>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegacion principal">
          {navItems.map(({ id, label, symbol }) => (
            <button
              key={id}
              type="button"
              className={activePage === id ? 'active' : ''}
              onClick={() => setActivePage(id)}
            >
              <span className="nav-symbol">{symbol}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <CurrentPage />
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<AppShell />);
