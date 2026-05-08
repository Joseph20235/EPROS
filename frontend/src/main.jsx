import React from 'react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import AdminColaboradores from './pages/AdminColaboradores.jsx';
import AdminEpsArl from './pages/AdminEpsArl.jsx';
import Historial from './pages/Historial.jsx';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import Reportes from './pages/Reportes.jsx';
import Seguimiento from './pages/Seguimiento.jsx';
import './styles.css';

const navItems = [
  { id: 'login', label: 'Login', symbol: 'IN', component: Login },
  { id: 'registro', label: 'Registro', symbol: 'RG', component: Registro, path: '/incapacidades/nueva' },
  { id: 'historial', label: 'Historial', symbol: 'HS', component: Historial },
  { id: 'seguimiento', label: 'Seguimiento', symbol: 'SG', component: Seguimiento },
  { id: 'reportes', label: 'Reportes', symbol: 'RP', component: Reportes },
  { id: 'admin-colaboradores', label: 'Colaboradores', symbol: 'CO', component: AdminColaboradores, path: '/admin/colaboradores' },
  { id: 'admin-eps-arl', label: 'EPS/ARL', symbol: 'EA', component: AdminEpsArl, path: '/admin/eps-arl' }
];

function AppShell() {
  const initialPage = navItems.find((item) => item.path === window.location.pathname)?.id ?? 'login';
  const [activePage, setActivePage] = useState(initialPage);
  const CurrentPage = navItems.find((item) => item.id === activePage)?.component ?? Login;

  function navigate(item) {
    setActivePage(item.id);
    window.history.pushState({}, '', item.path ?? '/');
  }

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
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activePage === item.id ? 'active' : ''}
              onClick={() => navigate(item)}
            >
              <span className="nav-symbol">{item.symbol}</span>
              <span>{item.label}</span>
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
