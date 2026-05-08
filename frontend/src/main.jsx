import React from 'react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import AdminColaboradores from './pages/AdminColaboradores.jsx';
import AdminEpsArl from './pages/AdminEpsArl.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ExpedienteIncapacidad from './pages/ExpedienteIncapacidad.jsx';
import Historial from './pages/Historial.jsx';
import Login from './pages/Login.jsx';
import RadicarIncapacidad from './pages/RadicarIncapacidad.jsx';
import Registro from './pages/Registro.jsx';
import Reportes from './pages/Reportes.jsx';
import Seguimiento from './pages/Seguimiento.jsx';
import TranscribirIncapacidad from './pages/TranscribirIncapacidad.jsx';
import ValidarIncapacidad from './pages/ValidarIncapacidad.jsx';
import './styles.css';

const navItems = [
  { id: 'login', label: 'Login', symbol: 'IN', component: Login },
  { id: 'dashboard', label: 'Dashboard', symbol: 'DB', component: Dashboard, path: '/dashboard' },
  { id: 'registro', label: 'Registro', symbol: 'RG', component: Registro, path: '/incapacidades/nueva' },
  { id: 'historial', label: 'Historial', symbol: 'HS', component: Historial, path: '/historial' },
  { id: 'seguimiento', label: 'Seguimiento', symbol: 'SG', component: Seguimiento, path: '/seguimiento' },
  { id: 'reportes', label: 'Reportes', symbol: 'RP', component: Reportes },
  { id: 'admin-colaboradores', label: 'Colaboradores', symbol: 'CO', component: AdminColaboradores, path: '/admin/colaboradores' },
  { id: 'admin-eps-arl', label: 'EPS/ARL', symbol: 'EA', component: AdminEpsArl, path: '/admin/eps-arl' }
];

function AppShell() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const validacionMatch = currentPath.match(/^\/incapacidades\/(\d+)\/validar$/);
  const transcripcionMatch = currentPath.match(/^\/incapacidades\/(\d+)\/transcribir$/);
  const radicacionMatch = currentPath.match(/^\/incapacidades\/(\d+)\/radicar$/);
  const expedienteMatch = currentPath.match(/^\/incapacidades\/(\d+)$/);
  const activePage =
    (validacionMatch && 'validacion') ||
    (transcripcionMatch && 'transcripcion') ||
    (radicacionMatch && 'radicacion') ||
    (expedienteMatch && 'historial') ||
    navItems.find((item) => item.path === currentPath)?.id ||
    'login';
  const CurrentPage = navItems.find((item) => item.id === activePage)?.component ?? Login;

  function navigate(item) {
    const nextPath = item.path ?? '/';
    window.history.pushState({}, '', nextPath);
    setCurrentPath(nextPath);
  }

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', syncPath);

    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  function renderPage() {
    if (validacionMatch) {
      return <ValidarIncapacidad incapacidadId={validacionMatch[1]} />;
    }

    if (transcripcionMatch) {
      return <TranscribirIncapacidad incapacidadId={transcripcionMatch[1]} />;
    }

    if (radicacionMatch) {
      return <RadicarIncapacidad incapacidadId={radicacionMatch[1]} />;
    }

    if (expedienteMatch) {
      return <ExpedienteIncapacidad incapacidadId={expedienteMatch[1]} />;
    }

    return <CurrentPage />;
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
        {renderPage()}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<AppShell />);
