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

let disponibilidadeAtual = [];

async function carregarSalas() {
    const salas = await chamarAPI('/api/salas');
    const select = document.getElementById('sala');
    select.innerHTML = '<option value="">Selecione uma sala</option>';
    salas.forEach(sala => {
        const option = document.createElement('option');
        option.value = sala.id;
        option.textContent = sala.nome;
        select.appendChild(option);
    });
}

function resetHorarios() {
    const inicio = document.getElementById('horaInicio');
    const fim = document.getElementById('horaFim');
    inicio.innerHTML = '<option value="" disabled selected>Escolha sala e data</option>';
    fim.innerHTML = '<option value="" disabled selected>Escolha o início primeiro</option>';
    inicio.disabled = true;
    fim.disabled = true;
}

function atualizarOpcoesHoraInicio() {
    const inicio = document.getElementById('horaInicio');
    const fim = document.getElementById('horaFim');
    inicio.innerHTML = '';

    if (!disponibilidadeAtual.length) {
        inicio.innerHTML = '<option value="" disabled selected>Nenhum horário disponível</option>';
        inicio.disabled = true;
        fim.innerHTML = '<option value="" disabled selected>Horário indisponível</option>';
        fim.disabled = true;
        return;
    }

    const placeholderInicio = document.createElement('option');
    placeholderInicio.value = '';
    placeholderInicio.textContent = 'Selecione o início';
    placeholderInicio.disabled = true;
    placeholderInicio.selected = true;
    inicio.appendChild(placeholderInicio);

    disponibilidadeAtual.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot[0];
        option.textContent = slot[0];
        inicio.appendChild(option);
    });

    inicio.disabled = false;
    fim.innerHTML = '<option value="" disabled selected>Escolha o início primeiro</option>';
    fim.disabled = true;
}

function atualizarOpcoesHoraFim() {
    const horaInicio = document.getElementById('horaInicio').value;
    const fim = document.getElementById('horaFim');
    fim.innerHTML = '';

    const placeholderFim = document.createElement('option');
    placeholderFim.value = '';
    placeholderFim.textContent = horaInicio ? 'Selecione o fim' : 'Escolha o início primeiro';
    placeholderFim.disabled = true;
    placeholderFim.selected = true;
    fim.appendChild(placeholderFim);

    if (!horaInicio) {
        fim.disabled = true;
        return;
    }

    const [horaInicioNum] = horaInicio.split(':').map(Number);
    const opcoesFim = [];
    let horaAtual = horaInicioNum + 1;

    while (horaAtual <= 19) {
        const blocoAnterior = String(horaAtual - 1).padStart(2, '0') + ':00';
        const blocoAtual = String(horaAtual).padStart(2, '0') + ':00';
        const possuiBloco = disponibilidadeAtual.some(slot => slot[0] === blocoAnterior && slot[1] === blocoAtual);
        if (!possuiBloco) {
            break;
        }
        opcoesFim.push(blocoAtual);
        horaAtual += 1;
    }

    if (!opcoesFim.length) {
        fim.innerHTML = '<option value="" disabled selected>Sem fim disponível</option>';
        fim.disabled = true;
        return;
    }

    opcoesFim.forEach(valor => {
        const option = document.createElement('option');
        option.value = valor;
        option.textContent = valor;
        fim.appendChild(option);
    });

    fim.disabled = false;
}

function isBusinessDay(dateString) {
    const data = new Date(dateString + 'T00:00:00');
    const dia = data.getDay();
    return dia >= 1 && dia <= 5;
}

function validarReservaLocal(dados) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataReserva = new Date(dados.data + 'T00:00:00');

    if (dataReserva < hoje) {
        return 'Não é possível reservar para datas já passadas.';
    }

    if (!isBusinessDay(dados.data)) {
        return 'Reservas só podem ser feitas de segunda a sexta-feira.';
    }

    const inicio = dados.hora_inicio;
    const fim = dados.hora_fim;
    const regexHora = /^([01]\d|2[0-3]):00$/;

    if (!regexHora.test(inicio) || !regexHora.test(fim)) {
        return 'Os horários devem ser na hora cheia, por exemplo 08:00, 09:00.';
    }

    const [horaInicio] = inicio.split(':').map(Number);
    const [horaFim] = fim.split(':').map(Number);

    if (horaFim <= horaInicio) {
        return 'Hora de fim deve ser posterior à hora de início.';
    }

    if (horaInicio < 8 || horaFim > 19) {
        return 'As reservas só podem ocorrer entre 08:00 e 19:00, com último bloco terminando às 19:00.';
    }

    return null;
}

async function carregarReservas() {
    const reservas = await chamarAPI('/api/reservas');
    const container = document.getElementById('reservas');
    if (!reservas.length) {
        container.innerHTML = '<p style="text-align:center; color:#777">Nenhuma reserva no momento.</p>';
        return;
    }
    container.innerHTML = reservas.map(reserva => `
        <div class="card">
            <div class="card-header">
                <div>
                    <h3 class="card-title">${reserva.titulo}</h3>
                    <p class="card-subtitle">${reserva.sala_nome}</p>
                </div>
            </div>
            <div>
                <p><strong>📅 Data:</strong> ${formatarData(reserva.data)}</p>
                <p><strong>🕐 Horário:</strong> ${formatarHora(reserva.hora_inicio)} - ${formatarHora(reserva.hora_fim)}</p>
                <p><strong>👤 Responsável:</strong> ${reserva.responsavel}</p>
                ${reserva.email ? `<p><strong>📧 Email:</strong> ${reserva.email}</p>` : ''}
                ${reserva.descricao ? `<p><strong>📝 Descrição:</strong> ${reserva.descricao}</p>` : ''}
            </div>
        </div>
    `).join('');
}

async function carregarDisponibilidade() {
    const salaId = document.getElementById('sala').value;
    const data = document.getElementById('data').value;
    const container = document.getElementById('disponibilidade');
    if (!salaId || !data) {
        disponibilidadeAtual = [];
        resetHorarios();
        container.innerHTML = '';
        return;
    }
    const resposta = await chamarAPI(`/api/disponibilidade?sala_id=${salaId}&data=${data}`);
    disponibilidadeAtual = resposta.disponiveis;
    atualizarOpcoesHoraInicio();
    container.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <h4>${resposta.sala_nome} - ${formatarData(resposta.data)}</h4>
            <p style="color:#555">${resposta.disponiveis.length} horários disponíveis</p>
        </div>
        <div class="availability-grid">
            ${resposta.disponiveis.map(slot => `
                <div class="time-slot available" onclick="selecionarHorario('${slot[0]}', '${slot[1]}', this)">
                    ${formatarHora(slot[0])}<br>–<br>${formatarHora(slot[1])}
                </div>
            `).join('')}
        </div>
        ${resposta.reservadas.length ? `<p style="margin-top:1rem; color:#555"><strong>Horários ocupados:</strong> ${resposta.reservadas.map(slot => `${formatarHora(slot[0])}-${formatarHora(slot[1])}`).join(', ')}</p>` : ''}
    `;
}

function selecionarHorario(horaInicio, horaFim, elemento) {
    const inputInicio = document.getElementById('horaInicio');
    const inputFim = document.getElementById('horaFim');
    inputInicio.value = horaInicio;
    inputFim.value = horaFim;
    inputFim.disabled = false;
    document.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
    elemento.classList.add('selected');
}

document.getElementById('sala').addEventListener('change', carregarDisponibilidade);
document.getElementById('data').addEventListener('change', (event) => {
    const dataSelecionada = event.target.value;
    if (dataSelecionada && !isBusinessDay(dataSelecionada)) {
        mostrarAlerta('Escolha um dia útil: segunda a sexta-feira.', 'error');
        event.target.value = '';
        document.getElementById('disponibilidade').innerHTML = '';
        resetHorarios();
        return;
    }
    carregarDisponibilidade();
});

document.getElementById('horaInicio').addEventListener('change', atualizarOpcoesHoraFim);

document.getElementById('formReserva').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
        sala_id: parseInt(document.getElementById('sala').value),
        titulo: document.getElementById('titulo').value,
        data: document.getElementById('data').value,
        hora_inicio: document.getElementById('horaInicio').value,
        hora_fim: document.getElementById('horaFim').value,
        responsavel: document.getElementById('responsavel').value,
        email: document.getElementById('email').value,
        descricao: document.getElementById('descricao').value
    };

    const erroLocal = validarReservaLocal(dados);
    if (erroLocal) {
        mostrarAlerta(erroLocal, 'error');
        return;
    }

    await chamarAPI('/api/reservas', {
        method: 'POST',
        body: JSON.stringify(dados)
    });
    mostrarAlerta('Reserva criada com sucesso!', 'success');
    document.getElementById('formReserva').reset();
    document.getElementById('disponibilidade').innerHTML = '';
    carregarReservas();
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('data').min = new Date().toISOString().split('T')[0];
    resetHorarios();
    carregarSalas();
    carregarReservas();
    setInterval(carregarReservas, 30000);
});
