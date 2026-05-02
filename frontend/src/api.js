const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    return data;
  }
  return data;
}

export function getSalas() {
  return request('/api/salas');
}

export function createSala(nome) {
  return request('/api/salas', {
    method: 'POST',
    body: JSON.stringify({ nome }),
  });
}

export function deleteSala(id) {
  return request(`/api/salas/${id}`, { method: 'DELETE' });
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

export function deleteReserva(id) {
  return request(`/api/reservas/${id}`, { method: 'DELETE' });
}

export function getDisponibilidade(salaId, data) {
  return request(`/api/disponibilidade?sala_id=${salaId}&data=${encodeURIComponent(data)}`);
}
