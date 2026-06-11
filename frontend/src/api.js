const BASE = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '');
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || BASE;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) return data;
  return data;
}

export function getSalas() { return request('/api/salas'); }
export function getReservas() { return request('/api/reservas'); }
export function createReserva(body) { return request('/api/reservas', { method: 'POST', body: JSON.stringify(body) }); }
export function getDisponibilidade(salaId, data) { return request(`/api/disponibilidade?sala_id=${salaId}&data=${encodeURIComponent(data)}`); }

export function createSala(salaData) {
  return request('/api/salas', { method: 'POST', body: JSON.stringify(salaData) });
}
export function updateSala(salaId, salaData) {
  return request(`/api/salas/${salaId}`, { method: 'PUT', body: JSON.stringify(salaData) });
}
export function deleteSala(id) { return request(`/api/salas/${id}`, { method: 'DELETE' }); }
export function deleteReserva(id) { return request(`/api/reservas/${id}`, { method: 'DELETE' }); }
export function adminLogin(senha) { return request('/api/admin/login', { method: 'POST', body: JSON.stringify({ senha }) }); }
export function adminLogout() { return request('/api/admin/logout', { method: 'POST' }); }

export function createReservaRecorrente(payload) {
  return request('/api/reservas/recorrente', { method: 'POST', body: JSON.stringify(payload) });
}
export function getReservasByGrupo(grupoId) { return request(`/api/reservas/grupo/${grupoId}`); }
export function deleteReservasByGrupo(grupoId) { return request(`/api/reservas/grupo/${grupoId}`, { method: 'DELETE' }); }

// Autenticação simples
export function authLogin(body) { return request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }); }
export function authRegister(body) { return request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }); }
export function authLogout() { return request('/api/auth/logout', { method: 'POST' }); }
export function whoami() { return request('/api/auth/whoami'); }

export function getUsers() { return request('/api/users'); }
export function updateUser(userId, data) { return request(`/api/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function approveUser(userId, cargo) { return request(`/api/users/${userId}/approve`, { method: 'POST', body: JSON.stringify({ cargo }) }); }


// Cancelar grupo recorrente pelo usuário (dono)
export function deleteUserGrupo(grupoId) {
  return request(`/api/reservas/grupo/${grupoId}/user`, { method: 'DELETE' });
}

export function updateReserva(reservaId, data) {
  return request(`/api/reservas/${reservaId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
export function getMinhasSolicitacoes() {
  return request('/api/minhas-solicitacoes');
}