import React from 'react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import AdminColaboradores from './pages/AdminColaboradores.jsx';
import AdminEpsArl from './pages/AdminEpsArl.jsx';
import Alertas from './pages/Alertas.jsx';
import CobroIncapacidad from './pages/CobroIncapacidad.jsx';
import ConciliacionIncapacidad from './pages/ConciliacionIncapacidad.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ExpedienteIncapacidad from './pages/ExpedienteIncapacidad.jsx';
import Historial from './pages/Historial.jsx';
import JuridicoIncapacidad from './pages/JuridicoIncapacidad.jsx';
import Login from './pages/Login.jsx';
import PagoIncapacidad from './pages/PagoIncapacidad.jsx';
import RadicarIncapacidad from './pages/RadicarIncapacidad.jsx';
import RechazoIncapacidad from './pages/RechazoIncapacidad.jsx';
import Registro from './pages/Registro.jsx';
import Reportes from './pages/Reportes.jsx';
import Seguimiento from './pages/Seguimiento.jsx';
import TranscribirIncapacidad from './pages/TranscribirIncapacidad.jsx';
import ValidarIncapacidad from './pages/ValidarIncapacidad.jsx';
import { instalarFetchAutenticado, logout, obtenerSesion, puedeAcceder } from './auth.js';
import './styles.css';

instalarFetchAutenticado();

const navItems = [
  { id: 'dashboard', label: 'Dashboard', symbol: 'DB', component: Dashboard, path: '/dashboard', roles: ['ADMIN', 'AUXILIAR'] },
  { id: 'registro', label: 'Registro', symbol: 'RG', component: Registro, path: '/incapacidades/nueva', roles: ['ADMIN', 'AUXILIAR'] },
  { id: 'historial', label: 'Historial', symbol: 'HS', component: Historial, path: '/historial', roles: ['ADMIN', 'AUXILIAR', 'READONLY'] },
  { id: 'seguimiento', label: 'Seguimiento', symbol: 'SG', component: Seguimiento, path: '/seguimiento', roles: ['ADMIN', 'AUXILIAR'] },
  { id: 'alertas', label: 'Alertas', symbol: 'AL', component: Alertas, path: '/alertas', roles: ['ADMIN', 'AUXILIAR'] },
  { id: 'reportes', label: 'Reportes', symbol: 'RP', component: Reportes, path: '/reportes', roles: ['ADMIN', 'AUXILIAR', 'READONLY'] },
  { id: 'admin-colaboradores', label: 'Colaboradores', symbol: 'CO', component: AdminColaboradores, path: '/admin/colaboradores', roles: ['ADMIN'] },
  { id: 'admin-eps-arl', label: 'EPS/ARL', symbol: 'EA', component: AdminEpsArl, path: '/admin/eps-arl', roles: ['ADMIN'] }
];

function AppShell() {
  const [sesion, setSesion] = useState(() => obtenerSesion());
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const rol = sesion?.usuario?.rol;
  const navPermitida = navItems.filter((item) => puedeAcceder(rol, item));
  const validacionMatch = currentPath.match(/^\/incapacidades\/(\d+)\/validar$/);
  const transcripcionMatch = currentPath.match(/^\/incapacidades\/(\d+)\/transcribir$/);
  const radicacionMatch = currentPath.match(/^\/incapacidades\/(\d+)\/radicar$/);
  const cobroMatch = currentPath.match(/^\/incapacidades\/(\d+)\/cobro$/);
  const pagoMatch = currentPath.match(/^\/incapacidades\/(\d+)\/pago$/);
  const rechazoMatch = currentPath.match(/^\/incapacidades\/(\d+)\/rechazo$/);
  const conciliacionMatch = currentPath.match(/^\/incapacidades\/(\d+)\/conciliacion$/);
  const juridicoMatch = currentPath.match(/^\/incapacidades\/(\d+)\/juridico$/);
  const expedienteMatch = currentPath.match(/^\/incapacidades\/(\d+)$/);
  const historialExpedienteMatch = currentPath.match(/^\/historial\/(\d+)$/);
  const activePage =
    (validacionMatch && 'validacion') ||
    (transcripcionMatch && 'transcripcion') ||
    (radicacionMatch && 'radicacion') ||
    (cobroMatch && 'cobro') ||
    (pagoMatch && 'pago') ||
    (rechazoMatch && 'rechazo') ||
    (conciliacionMatch && 'conciliacion') ||
    (juridicoMatch && 'juridico') ||
    (historialExpedienteMatch && 'historial') ||
    (expedienteMatch && 'historial') ||
    navItems.find((item) => item.path === currentPath)?.id ||
    navPermitida[0]?.id;
  const CurrentPage = navItems.find((item) => item.id === activePage)?.component ?? Login;

   const rutaActual = navItems.find((item) => item.id === activePage);
  const rutaGestion =
    validacionMatch ||
    transcripcionMatch ||
    radicacionMatch ||
    cobroMatch ||
    pagoMatch ||
    rechazoMatch ||
    conciliacionMatch ||
    juridicoMatch ||
    currentPath === '/incapacidades/nueva' ||
    currentPath === '/seguimiento' ||
    currentPath === '/alertas';
  const rutaAdmin = currentPath.startsWith('/admin/');
  const rutaLectura =
    currentPath === '/historial' ||
    currentPath === '/reportes' ||
    Boolean(historialExpedienteMatch) ||
    Boolean(expedienteMatch);
  const autorizado =
    sesion &&
    ((rutaActual && puedeAcceder(rol, rutaActual)) ||
      (rutaLectura && ['ADMIN', 'AUXILIAR', 'READONLY'].includes(rol)) ||
      (rutaGestion && ['ADMIN', 'AUXILIAR'].includes(rol)) ||
      (rutaAdmin && rol === 'ADMIN'));

  function navigate(item) {
    const nextPath = item.path ?? '/';
    window.history.pushState({}, '', nextPath);
    setCurrentPath(nextPath);
  }

  useEffect(() => {
    const syncPath = () => setCurrentPath(window.location.pathname);
    const syncSesion = () => setSesion(obtenerSesion());
    window.addEventListener('popstate', syncPath);
    window.addEventListener('epros-auth-change', syncSesion);

    return () => {
      window.removeEventListener('popstate', syncPath);
      window.removeEventListener('epros-auth-change', syncSesion);
    };
  }, []);

    useEffect(() => {
    if (!sesion) return;
    if (!navPermitida.length) return;
    if (currentPath === '/' || currentPath === '/login' || !autorizado) {
      const nextPath = navPermitida[0].path;
      window.history.replaceState({}, '', nextPath);
      setCurrentPath(nextPath);
    }
  }, [autorizado, currentPath, navPermitida, sesion]);

  if (!sesion) {
    return <Login />;
  }

  function renderPage() {
    if (!autorizado) {
      return (
        <section className="page">
          <header className="page-header">
            <div>
              <p>Acceso restringido</p>
              <h1>No tienes permisos para este modulo</h1>
            </div>
          </header>
          <div className="panel">
            <p className="empty-state">Tu rol actual es {rol}. Selecciona una opcion disponible en el menu.</p>
          </div>
        </section>
      );
    }

    if (validacionMatch) {
      return <ValidarIncapacidad incapacidadId={validacionMatch[1]} />;
    }

    if (transcripcionMatch) {
      return <TranscribirIncapacidad incapacidadId={transcripcionMatch[1]} />;
    }

    if (radicacionMatch) {
      return <RadicarIncapacidad incapacidadId={radicacionMatch[1]} />;
    }

    if (cobroMatch) {
      return <CobroIncapacidad incapacidadId={cobroMatch[1]} />;
    }

    if (pagoMatch) {
      return <PagoIncapacidad incapacidadId={pagoMatch[1]} />;
    }

    if (rechazoMatch) {
      return <RechazoIncapacidad incapacidadId={rechazoMatch[1]} />;
    }

    if (conciliacionMatch) {
      return <ConciliacionIncapacidad incapacidadId={conciliacionMatch[1]} />;
    }

    if (juridicoMatch) {
      return <JuridicoIncapacidad incapacidadId={juridicoMatch[1]} />;
    }

    if (expedienteMatch) {
      return <ExpedienteIncapacidad incapacidadId={expedienteMatch[1]} />;
    }

    if (historialExpedienteMatch) {
      return <ExpedienteIncapacidad incapacidadId={historialExpedienteMatch[1]} soloLectura />;
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
            <small>{sesion.usuario.nombre_completo}</small>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegacion principal">
          {navPermitida.map((item) => (
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
          <button type="button" onClick={() => logout()}>
            <span className="nav-symbol">SA</span>
            <span>Salir</span>
          </button>
        </nav>
      </aside>

      <main className="content">
        {renderPage()}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<AppShell />);
