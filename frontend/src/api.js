const BASE = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '');
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || BASE;

export const PORTAL_AUTH_URL = import.meta.env.VITE_PORTAL_AUTH_URL || 'http://localhost:3000';

// ---------- GERENCIAMENTO DE TOKEN ----------
export function getToken() {
  return localStorage.getItem('auth_token');
}
export function setToken(token) {
  localStorage.setItem('auth_token', token);
}
export function removeToken() {
  localStorage.removeItem('auth_token');
}

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Em dev mode sem token, envia header especial para acionar o mock do backend
  else if (DEV_MODE) headers['Authorization'] = 'Bearer dev-mock';
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json();
  return data;
}

// ---------- SALAS ----------
export function getSalas() { return request('/api/salas'); }
export function createSala(salaData) { return request('/api/salas', { method: 'POST', body: JSON.stringify(salaData) }); }
export function updateSala(salaId, salaData) { return request(`/api/salas/${salaId}`, { method: 'PUT', body: JSON.stringify(salaData) }); }
export function deleteSala(id) { return request(`/api/salas/${id}`, { method: 'DELETE' }); }

// ---------- RESERVAS ----------
export function getReservas() { return request('/api/reservas'); }
export function createReserva(body) { return request('/api/reservas', { method: 'POST', body: JSON.stringify(body) }); }
export function updateReserva(reservaId, data) { return request(`/api/reservas/${reservaId}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteReserva(id) { return request(`/api/reservas/${id}`, { method: 'DELETE' }); }
export function createReservaRecorrente(payload) { return request('/api/reservas/recorrente', { method: 'POST', body: JSON.stringify(payload) }); }
export function getReservasByGrupo(grupoId) { return request(`/api/reservas/grupo/${grupoId}`); }
export function deleteReservasByGrupo(grupoId) { return request(`/api/reservas/grupo/${grupoId}`, { method: 'DELETE' }); }
export function deleteUserGrupo(grupoId) { return request(`/api/reservas/grupo/${grupoId}/user`, { method: 'DELETE' }); }
export function getDisponibilidade(salaId, data) { return request(`/api/disponibilidade?sala_id=${salaId}&data=${encodeURIComponent(data)}`); }
export function getMinhasSolicitacoes() { return request('/api/minhas-solicitacoes'); }

// ---------- SOLICITAÇÕES ----------
export function getSolicitacoes() { return request('/api/solicitacoes'); }
export function getSolicitacoesRejeitadas() { return request('/api/solicitacoes/rejeitadas'); }
export function aprovarSolicitacao(id) { return request(`/api/solicitacoes/${id}/aprovar`, { method: 'POST' }); }
export function rejeitarSolicitacao(id) { return request(`/api/solicitacoes/${id}/rejeitar`, { method: 'POST' }); }

// ---------- MANUTENÇÕES ----------
export function getManutencoes() { return request('/api/manutencoes'); }
export function createManutencao(body) { return request('/api/manutencoes', { method: 'POST', body: JSON.stringify(body) }); }
export function deleteManutencao(id) { return request(`/api/manutencoes/${id}`, { method: 'DELETE' }); }

// ---------- DISPONIBILIDADE ----------
export function getSalasDisponiveis(data, horaInicio, horaFim) {
  return request(`/api/salas/disponiveis?data=${data}&hora_inicio=${horaInicio}&hora_fim=${horaFim}`);
}

// ---------- RESERVA POR ID ----------
export function getReservaById(id) { return request(`/api/reservas/${id}`); }

// ---------- USUÁRIOS ----------
export function getUsers() { return request('/api/users'); }
export function updateUser(userId, data) { return request(`/api/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function approveUser(userId, cargo) { return request(`/api/users/${userId}/approve`, { method: 'POST', body: JSON.stringify({ cargo }) }); }

// ---------- NOTIFICAÇÕES ----------
export function getNotificacoes() { return request('/api/notificacoes'); }
export function marcarNotificacaoLida(id) { return request(`/api/notificacoes/${id}/marcar-lida`, { method: 'PUT' }); }
export function marcarTodasNotificacoesLidas() { return request('/api/notificacoes/marcar-todas-lidas', { method: 'PUT' }); }
export function removerNotificacao(id) { return request(`/api/notificacoes/${id}`, { method: 'DELETE' }); }

// ---------- AUTENTICAÇÃO ----------
export function whoami() { return request('/api/auth/whoami'); }

export async function authLogin(body) {
  const response = await fetch(`${PORTAL_AUTH_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

export function authLogout() {
  removeToken();
  return Promise.resolve({ sucesso: true });
}
