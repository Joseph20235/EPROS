const STORAGE_KEY = 'epros_sesion';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export function obtenerSesion() {
  try {
    const sesion = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!sesion?.token || !sesion?.usuario) return null;
    if (sesion.expira_en && new Date(sesion.expira_en).getTime() <= Date.now()) {
      limpiarSesion();
      return null;
    }
    return sesion;
  } catch {
    limpiarSesion();
    return null;
  }
}

export function guardarSesion(sesion) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
  window.dispatchEvent(new CustomEvent('epros-auth-change', { detail: sesion }));
}

export function limpiarSesion() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('epros-auth-change', { detail: null }));
}

export async function login(correo, password) {
  const respuesta = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, password })
  });
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(datos.error ?? 'No fue posible iniciar sesion.');
  }

  guardarSesion(datos);
  return datos;
}

export async function logout() {
  const sesion = obtenerSesion();

  if (sesion?.token) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sesion.token}` }
    }).catch(() => null);
  }

  limpiarSesion();
}

export function instalarFetchAutenticado() {
  if (window.__eprosFetchAutenticado) return;

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    const esApiEpros = typeof url === 'string' && url.startsWith(API_BASE) && !url.includes('/auth/login');
    const sesion = obtenerSesion();

    if (!esApiEpros || !sesion?.token) {
      return fetchOriginal(input, init);
    }

    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${sesion.token}`);

    const respuesta = await fetchOriginal(input, { ...init, headers });

    if (respuesta.status === 401) {
      limpiarSesion();
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }

    return respuesta;
  };

  window.__eprosFetchAutenticado = true;
}

export function puedeAcceder(rol, item) {
  if (!item.roles) return true;
  return item.roles.includes(rol);
}