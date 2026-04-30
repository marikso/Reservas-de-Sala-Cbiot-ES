function mostrarAlerta(mensagem, tipo = 'success') {
    const alerta = document.getElementById('alert');
    alerta.textContent = mensagem;
    alerta.className = `alert show ${tipo}`;
    setTimeout(() => {
        alerta.className = 'alert hidden';
    }, 4000);
}

function formatarData(data) {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatarHora(hora) {
    return hora.substring(0, 5);
}

async function chamarAPI(url, opcoes = {}) {
    try {
        const resposta = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...opcoes.headers
            },
            ...opcoes
        });
        if (!resposta.ok) {
            const erro = await resposta.json();
            throw new Error(erro.erro || 'Erro na requisição');
        }
        return await resposta.json();
    } catch (erro) {
        mostrarAlerta(erro.message, 'error');
        throw erro;
    }
}

async function carregarSalas() {
    const salas = await chamarAPI('/api/salas');
    const container = document.getElementById('salas');
    const select = document.getElementById('filtroSala');
    container.innerHTML = salas.length
        ? salas.map(sala => `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${sala.nome}</h3>
                    </div>
                    <button class="btn btn-danger" onclick="deletarSala(${sala.id})">Deletar</button>
                </div>
                <div>
                    ${sala.descricao ? `<p><strong>Descrição:</strong> ${sala.descricao}</p>` : ''}
                </div>
            </div>
        `).join('')
        : '<p>Nenhuma sala cadastrada.</p>';

    select.innerHTML = '<option value="">Todas as salas</option>' + salas.map(sala => `<option value="${sala.id}">${sala.nome}</option>`).join('');
}

document.getElementById('formSala').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
        nome: document.getElementById('nomeSala').value,
        descricao: document.getElementById('descricaoSala').value
    };
    await chamarAPI('/api/salas', {
        method: 'POST',
        body: JSON.stringify(dados)
    });
    mostrarAlerta('Sala criada com sucesso!', 'success');
    document.getElementById('formSala').reset();
    carregarSalas();
});

async function deletarSala(salaId) {
    if (!confirm('Tem certeza que deseja deletar esta sala?')) {
        return;
    }
    await chamarAPI(`/api/salas/${salaId}`, { method: 'DELETE' });
    mostrarAlerta('Sala deletada com sucesso!', 'success');
    carregarSalas();
    carregarReservasAdmin();
}

async function carregarReservasAdmin() {
    let url = '/api/reservas?';
    const filtroData = document.getElementById('filtroData').value;
    const filtroSala = document.getElementById('filtroSala').value;
    if (filtroData) url += `data=${filtroData}&`;
    if (filtroSala) url += `sala_id=${filtroSala}&`;
    const reservas = await chamarAPI(url);
    const container = document.getElementById('reservasAdmin');
    container.innerHTML = reservas.length
        ? reservas.map(reserva => `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${reserva.titulo}</h3>
                        <p class="card-subtitle">${reserva.sala_nome}</p>
                    </div>
                    <button class="btn btn-danger" onclick="deletarReserva(${reserva.id})">Cancelar</button>
                </div>
                <div>
                    <p><strong>Data:</strong> ${formatarData(reserva.data)}</p>
                    <p><strong>Horário:</strong> ${formatarHora(reserva.hora_inicio)} - ${formatarHora(reserva.hora_fim)}</p>
                    <p><strong>Responsável:</strong> ${reserva.responsavel}</p>
                    ${reserva.email ? `<p><strong>Email:</strong> ${reserva.email}</p>` : ''}
                    ${reserva.descricao ? `<p><strong>Descrição:</strong> ${reserva.descricao}</p>` : ''}
                </div>
            </div>
        `).join('')
        : '<p>Nenhuma reserva encontrada.</p>';
}

async function deletarReserva(reservaId) {
    if (!confirm('Deseja cancelar esta reserva?')) return;
    await chamarAPI(`/api/reservas/${reservaId}`, { method: 'DELETE' });
    mostrarAlerta('Reserva cancelada com sucesso!', 'success');
    carregarReservasAdmin();
}

document.addEventListener('DOMContentLoaded', () => {
    carregarSalas();
    carregarReservasAdmin();
    setInterval(() => {
        carregarSalas();
        carregarReservasAdmin();
    }, 30000);
});
