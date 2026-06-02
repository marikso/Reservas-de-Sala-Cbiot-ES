// URL base do backend Flask (porta 5000). Pode ser sobrescrita por variável de ambiente.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Função genérica para requisições HTTP com tratamento de JSON e credenciais (cookies de sessão)
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',               // envia cookies de sessão (admin)
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    return data;                           // retorna o objeto de erro (ex.: {erro: "..."})
  }
  return data;                             // retorna os dados JSON em caso de sucesso
}

// Rotas públicas
export function getSalas() {
  return request('/api/salas');
}

export function getReservas() {
  return request('/api/reservas');
}

export function createReserva(body) {
  return request('/api/reservas', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getDisponibilidade(salaId, data) {
  return request(`/api/disponibilidade?sala_id=${salaId}&data=${encodeURIComponent(data)}`);
}

// Rotas administrativas (protegidas no backend)
export function createSala(salaData) {
  return request('/api/salas', {
    method: 'POST',
    body: JSON.stringify(salaData),
  });
}

export function deleteSala(id) {
  return request(`/api/salas/${id}`, { method: 'DELETE' });
}

export function deleteReserva(id) {
  return request(`/api/reservas/${id}`, { method: 'DELETE' });
}

export function adminLogin(senha) {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ senha }),
  });
}

export function adminLogout() {
  return request('/api/admin/logout', {
    method: 'POST',
  });
}

// Reservas recorrentes e grupo
export function createReservaRecorrente(payload) {
  return request('/api/reservas/recorrente', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getReservasByGrupo(grupoId) {
  return request(`/api/reservas/grupo/${grupoId}`);
}

export function deleteReservasByGrupo(grupoId) {
  return request(`/api/reservas/grupo/${grupoId}`, { method: 'DELETE' });
}