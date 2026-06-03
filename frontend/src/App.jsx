import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getSalas,
  getReservas,
  createReserva,
  createReservaRecorrente,
  getDisponibilidade,
  deleteReservasByGrupo,
} from './api';

// ========== FUNÇÕES AUXILIARES DE HORÁRIO (30 minutos) ==========
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};
const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const add30min = (timeStr) => minutesToTime(timeToMinutes(timeStr) + 30);

const generateAllStartTimes = () => {
  const times = [];
  let mins = 8 * 60;
  while (mins < 19 * 60) {
    times.push(minutesToTime(mins));
    mins += 30;
  }
  return times;
};
const generateAllEndTimes = () => {
  const times = [];
  let mins = 8 * 60 + 30;
  while (mins <= 19 * 60) {
    times.push(minutesToTime(mins));
    mins += 30;
  }
  return times;
};

function App() {
  // ========== ESTADOS ==========
  const [salas, setSalas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [disponibilidade, setDisponibilidade] = useState(null);
  const [form, setForm] = useState({
    sala_id: '',
    titulo: '',
    data: '',
    hora_inicio: '08:00',
    hora_fim: '08:30',
    responsavel: '',
    email: '',
    descricao: '',
  });
  const [toast, setToast] = useState(null);
  const [reservasDoDia, setReservasDoDia] = useState([]);
  const [recorrente, setRecorrente] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [dataFim, setDataFim] = useState('');

  // Estados para consulta de disponibilidade
  const [modoDisponibilidade, setModoDisponibilidade] = useState('sala');
  const [disponibilidadeDataHora, setDisponibilidadeDataHora] = useState(null);
  const [dataConsulta, setDataConsulta] = useState('');
  const [horaConsulta, setHoraConsulta] = useState('08:00');
  const [horaFimConsulta, setHoraFimConsulta] = useState('08:30');

  const dataSelecionada = !!form.data;

  // ========== CARREGAMENTO INICIAL ==========
  const loadSalas = async () => {
    const data = await getSalas();
    setSalas(data);
  };
  const loadReservas = async () => {
    const data = await getReservas();
    const hoje = new Date().toISOString().slice(0, 10);
    const reservasAtivas = data.filter(r => r.data >= hoje);
    setReservas(reservasAtivas);
  };

  useEffect(() => {
    loadSalas();
    loadReservas();
  }, []);

  // ========== AUXILIARES ==========
  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  // ========== LÓGICA DE HORÁRIOS DISPONÍVEIS (formulário) ==========
  const reservasIntervalos = useMemo(() => {
    return reservasDoDia.map((r) => ({
      inicio: timeToMinutes(r.hora_inicio),
      fim: timeToMinutes(r.hora_fim),
    }));
  }, [reservasDoDia]);

  const conflita = (inicio, fim) => {
    return reservasIntervalos.some((r) => inicio < r.fim && fim > r.inicio);
  };

  const todosInicios = useMemo(() => generateAllStartTimes(), []);
  const todosFins = useMemo(() => generateAllEndTimes(), []);

  const horasInicioDisponiveis = useMemo(() => {
    if (!dataSelecionada && !recorrente) return [];
    if (recorrente) return todosInicios;
    return todosInicios.filter((inicio) => {
      const fim = add30min(inicio);
      return !conflita(timeToMinutes(inicio), timeToMinutes(fim));
    });
  }, [todosInicios, dataSelecionada, recorrente, reservasIntervalos]);

  const horasFimDisponiveis = useMemo(() => {
    if (!form.hora_inicio) return [];
    const inicioMin = timeToMinutes(form.hora_inicio);
    if (recorrente) {
      return todosFins.filter((fimStr) => timeToMinutes(fimStr) > inicioMin);
    }
    const proximosInicios = reservasIntervalos
      .map((r) => r.inicio)
      .filter((min) => min > inicioMin)
      .sort((a, b) => a - b);
    const limite = proximosInicios.length ? proximosInicios[0] : 19 * 60;
    return todosFins.filter((fimStr) => {
      const fimMin = timeToMinutes(fimStr);
      return fimMin > inicioMin && fimMin <= limite;
    });
  }, [form.hora_inicio, todosFins, recorrente, reservasIntervalos]);

  useEffect(() => {
    if (horasFimDisponiveis.length && !horasFimDisponiveis.includes(form.hora_fim)) {
      setForm((prev) => ({ ...prev, hora_fim: horasFimDisponiveis[0] }));
    }
  }, [horasFimDisponiveis, form.hora_fim]);

  useEffect(() => {
    if (!recorrente && dataSelecionada && horasInicioDisponiveis.length) {
      if (!horasInicioDisponiveis.includes(form.hora_inicio)) {
        setForm((prev) => ({ ...prev, hora_inicio: horasInicioDisponiveis[0] }));
      }
    }
  }, [horasInicioDisponiveis, form.hora_inicio, dataSelecionada, recorrente]);

  // ========== MANIPULAÇÃO DE RESERVAS ==========
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmitReserva = async (e) => {
    e.preventDefault();
    if (!form.sala_id) {
      showToast('Escolha uma sala antes de reservar', 'error');
      return;
    }
    if (!recorrente && !form.data) {
      showToast('Selecione uma data', 'error');
      return;
    }
    if (recorrente && (!dataFim || diasSelecionados.length === 0)) {
      showToast('Informe a data final e pelo menos um dia da semana', 'error');
      return;
    }

    let response;
    if (recorrente) {
      const payload = {
        sala_id: form.sala_id,
        titulo: form.titulo,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        dias_semana: diasSelecionados,
        data_inicio: form.data,
        data_fim: dataFim,
        responsavel: form.responsavel,
        email: form.email,
        descricao: form.descricao,
      };
      response = await createReservaRecorrente(payload);
    } else {
      response = await createReserva(form);
    }

    if (response.erro) {
      showToast(response.erro, 'error');
      return;
    }

    if (recorrente) {
      if (response.conflitos && response.conflitos.length > 0) {
        const conflitosStr = response.conflitos.join(', ');
        const userConfirmed = window.confirm(
          `Existem conflitos nas seguintes datas: ${conflitosStr}\n\nDeseja criar as reservas apenas para as datas disponíveis?`
        );
        if (!userConfirmed) {
          if (response.grupo_id) {
            await deleteReservasByGrupo(response.grupo_id);
            showToast('Operação cancelada.', 'info');
          } else {
            showToast('Nenhuma reserva foi criada.', 'error');
          }
          await loadReservas();
          return;
        } else {
          showToast(`${response.reservas_criadas.length} reservas criadas.`, 'success');
        }
      } else {
        showToast(response.mensagem, 'success');
      }
      await loadReservas();
      setForm((prev) => ({ ...prev, titulo: '', responsavel: '', email: '', descricao: '' }));
      setDataFim('');
      setDiasSelecionados([]);
      setRecorrente(false);
    } else {
      showToast('Reserva criada com sucesso!', 'success');
      setForm((prev) => ({ ...prev, titulo: '', responsavel: '', email: '', descricao: '' }));
      await loadReservas();
    }
  };

  // ========== DISPONIBILIDADE (modo sala/data) ==========
  const handleDisponibilidade = async () => {
    if (!form.sala_id || !form.data) {
      showToast('Escolha sala e data para ver disponibilidade', 'error');
      return;
    }
    const response = await getDisponibilidade(form.sala_id, form.data);
    if (response.erro) {
      showToast(response.erro, 'error');
      return;
    }
    setDisponibilidade(response);
  };

  useEffect(() => {
    if (!form.sala_id || !form.data) {
      setReservasDoDia([]);
      return;
    }
    getDisponibilidade(form.sala_id, form.data).then((response) => {
      if (response?.horarios) {
        setReservasDoDia(response.horarios.filter((h) => h.ocupado));
      }
    });
  }, [form.sala_id, form.data]);

  // ========== CONSULTA POR DATA/HORA (intervalo) ==========
  const handleConsultarDisponibilidadeDataHora = async () => {
    if (!dataConsulta || !horaConsulta || !horaFimConsulta) {
      showToast('Selecione data, início e fim', 'error');
      return;
    }
    const res = await fetch(`http://localhost:5000/api/salas/disponiveis?data=${dataConsulta}&hora_inicio=${horaConsulta}&hora_fim=${horaFimConsulta}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      setDisponibilidadeDataHora(data);
    } else {
      showToast(data.erro || 'Erro na consulta', 'error');
    }
  };

  // ========== ORDENAÇÃO DAS SALAS PARA MAPA ==========
  const salasOrdenadas = useMemo(() => {
    return [...salas].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));
  }, [salas]);

  // ========== RENDER ==========
  const selectsDisabled = !dataSelecionada && !recorrente;
  const camposTextDisabled = !dataSelecionada && !recorrente;

  return (
    <div className="app-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <header>
        <div className="header-content">
          <img src="/CBiot_logo.jpg" alt="Logo CBiot" className="logo" />
          <h1 className="central-title">Sistema de Reserva de Sala do CBiot</h1>
        </div>
      </header>

      {/* MAPA DE SALAS */}
      <section className="box mapa-salas">
        <h2>🗺️ Mapa das Salas</h2>
        <div className="salas-grid-mapa">
          {salasOrdenadas.map((sala) => (
            <div
              key={sala.id}
              className={`sala-card-mapa ${form.sala_id == sala.id ? 'selecionada' : ''} ${sala.em_manutencao ? 'manutencao' : ''}`}
              onClick={() => setForm((prev) => ({ ...prev, sala_id: sala.id }))}
            >
              <div className="sala-nome">{sala.nome}</div>
              <div className="sala-localizacao">📍 Bloco {sala.bloco || '?'} | {sala.andar || 'Andar não informado'}</div>
              <div className="sala-info">👥 Capacidade: {sala.capacidade || '?'} pessoas</div>
              {sala.equipamentos && (
                <div className="sala-equipamentos">
                  <strong>📋 Equipamentos:</strong>
                  <ul>
                    {sala.equipamentos.split(',').map((item, idx) => (
                      <li key={idx}>{item.trim()}</li>
                    ))}
                  </ul>
                </div>
              )}
              {sala.em_manutencao && <div className="sala-manutencao-badge">🔧 Em manutenção</div>}
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO DE CONSULTA DE DISPONIBILIDADE */}
      <section className="box">
        <h2>🔍 Consultar disponibilidade</h2>
        <div className="modo-consulta">
          <label>
            <input type="radio" value="sala" checked={modoDisponibilidade === 'sala'} onChange={() => setModoDisponibilidade('sala')} />
            Por sala e data
          </label>
          <label>
            <input type="radio" value="data_hora" checked={modoDisponibilidade === 'data_hora'} onChange={() => setModoDisponibilidade('data_hora')} />
            Por data e hora (intervalo)
          </label>
        </div>

        {modoDisponibilidade === 'sala' ? (
          <div className="consulta-sala">
            <label>
              Sala:
              <select value={form.sala_id} onChange={(e) => setForm((prev) => ({ ...prev, sala_id: e.target.value }))}>
                <option value="">Selecione</option>
                {salas.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </label>
            <label>
              Data:
              <input type="date" value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} />
            </label>
            <button onClick={handleDisponibilidade}>Ver disponibilidade</button>
          </div>
        ) : (
          <div className="consulta-data-hora">
            <label>
              Data:
              <input type="date" value={dataConsulta} onChange={(e) => setDataConsulta(e.target.value)} />
            </label>
            <label>
              Início:
              <select value={horaConsulta} onChange={(e) => setHoraConsulta(e.target.value)}>
                {todosInicios.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
            <label>
              Fim:
              <select value={horaFimConsulta} onChange={(e) => setHoraFimConsulta(e.target.value)}>
                {todosFins.filter(f => timeToMinutes(f) > timeToMinutes(horaConsulta)).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
            <button onClick={handleConsultarDisponibilidadeDataHora}>Buscar salas disponíveis</button>
          </div>
        )}

        {/* Resultado da consulta - modo sala/data (com clique nos horários livres) */}
        {modoDisponibilidade === 'sala' && disponibilidade && (
          <div className="resultado-disponibilidade">
            <h3>Horários disponíveis - {disponibilidade.sala_nome} ({formatarData(disponibilidade.data)})</h3>
            <ul className="grid-list">
              {disponibilidade.horarios.map((item) => (
                <li
                  key={`${item.hora_inicio}-${item.hora_fim}`}
                  className={
                    item.ocupado
                      ? item.titulo && item.titulo.startsWith('Manutenção')
                        ? 'manutencao'
                        : 'ocupado'
                      : 'livre'
                  }
                  onClick={() => {
                    if (!item.ocupado) {
                      setForm((prev) => ({
                        ...prev,
                        sala_id: form.sala_id,
                        data: form.data,
                        hora_inicio: item.hora_inicio,
                        hora_fim: item.hora_fim,
                      }));
                      document.getElementById('form-reserva')?.scrollIntoView({ behavior: 'smooth' });
                      showToast(`Horário ${item.hora_inicio} - ${item.hora_fim} selecionado`, 'info');
                    }
                  }}
                  style={item.ocupado ? {} : { cursor: 'pointer' }}
                >
                  <strong>{item.hora_inicio}</strong> - {item.hora_fim}
                  <strong>{item.ocupado ? item.titulo : ' Livre'}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {modoDisponibilidade === 'data_hora' && disponibilidadeDataHora && (
          <div className="resultado-disponibilidade">
            <h3>Salas disponíveis em {formatarData(dataConsulta)} das {horaConsulta} às {horaFimConsulta}</h3>
            {disponibilidadeDataHora.length === 0 ? (
              <p>Nenhuma sala disponível nesse horário.</p>
            ) : (
              <div className="salas-disponiveis-grid">
                {disponibilidadeDataHora.map((sala) => (
                  <div
                    key={sala.id}
                    className="sala-card-mapa"
                    onClick={() => {
                      setForm({
                        sala_id: sala.id,
                        titulo: form.titulo,
                        data: dataConsulta,
                        hora_inicio: horaConsulta,
                        hora_fim: horaFimConsulta,
                        responsavel: form.responsavel,
                        email: form.email,
                        descricao: form.descricao,
                      });
                      setModoDisponibilidade('sala');
                      document.getElementById('form-reserva')?.scrollIntoView({ behavior: 'smooth' });
                      showToast('Formulário preenchido com a sala e horário selecionados', 'info');
                    }}
                  >
                    <div className="sala-nome">{sala.nome}</div>
                    <div className="sala-localizacao">📍 Bloco {sala.bloco || '?'} | {sala.andar || '?'}</div>
                    <div className="sala-info">👥 Capacidade: {sala.capacidade || '?'}</div>
                    {sala.equipamentos && (
                      <div className="sala-equipamentos">📋 {sala.equipamentos.substring(0, 50)}...</div>
                    )}
                    <button className="small-btn">Selecionar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* FORMULÁRIO DE RESERVA (com id para rolagem) */}
      <section className="box" id="form-reserva">
        <h2>📝 Fazer reserva</h2>
        <form onSubmit={handleSubmitReserva} className="form-grid">
          <label>
            Sala *
            <select name="sala_id" value={form.sala_id} onChange={handleChange} required>
              <option value="">Selecione uma sala</option>
              {salasOrdenadas.map((sala) => (
                <option key={sala.id} value={sala.id}>{sala.nome}</option>
              ))}
            </select>
          </label>

          <label>
            Data *
            <input type="date" name="data" value={form.data} onChange={handleChange} required={!recorrente} disabled={recorrente} />
          </label>

          <label>
            Início *
            <select name="hora_inicio" value={form.hora_inicio} onChange={handleChange} required disabled={selectsDisabled}>
              {horasInicioDisponiveis.length > 0 ? (
                horasInicioDisponiveis.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))
              ) : (
                <option value="" disabled>Nenhum horário disponível</option>
              )}
            </select>
          </label>

          <label>
            Fim *
            <select name="hora_fim" value={form.hora_fim} onChange={handleChange} required disabled={selectsDisabled}>
              {horasFimDisponiveis.length > 0 ? (
                horasFimDisponiveis.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))
              ) : (
                <option value="" disabled>Nenhum horário disponível</option>
              )}
            </select>
          </label>

          <label>
            Título *
            <input type="text" name="titulo" value={form.titulo} onChange={handleChange} required disabled={camposTextDisabled} />
          </label>

          <label>
            Responsável *
            <input type="text" name="responsavel" value={form.responsavel} onChange={handleChange} required disabled={camposTextDisabled} />
          </label>

          <label>
            E-mail *
            <input type="email" name="email" value={form.email} onChange={handleChange} required disabled={camposTextDisabled} />
          </label>

          <label>
            Descrição
            <textarea name="descricao" value={form.descricao} onChange={handleChange} rows="3" disabled={camposTextDisabled} />
          </label>

          <div className="full-width">
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
              Reserva recorrente (mesmo horário todas as semanas)
            </label>
          </div>

          {recorrente && (
            <>
              <label className="full-width">
                Dias da semana (segunda a sexta):
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {[
                    { label: 'Segunda', value: 0 },
                    { label: 'Terça', value: 1 },
                    { label: 'Quarta', value: 2 },
                    { label: 'Quinta', value: 3 },
                    { label: 'Sexta', value: 4 },
                  ].map((day) => (
                    <label key={day.value} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.3rem' }}>
                      <input
                        type="checkbox"
                        value={day.value}
                        checked={diasSelecionados.includes(day.value)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (e.target.checked) {
                            setDiasSelecionados([...diasSelecionados, val]);
                          } else {
                            setDiasSelecionados(diasSelecionados.filter((d) => d !== val));
                          }
                        }}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </label>
              <label>
                Data final (repetir até):
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} required />
              </label>
            </>
          )}

          <div className="actions">
            <button type="submit" disabled={!dataSelecionada && !recorrente || (dataSelecionada && horasInicioDisponiveis.length === 0)}>
              Reservar
            </button>
          </div>
        </form>
      </section>

      {/* RESERVAS CONFIRMADAS */}
      <section className="box">
        <h2>📋 Reservas Confirmadas</h2>
        <div className="reservas-grid">
          {reservas.map((reserva) => {
            const sala = salas.find((s) => s.id === reserva.sala_id);
            return (
              <div className="reserva-card" key={reserva.id}>
                <h3>{reserva.sala_nome}</h3>
                <p><strong>Título:</strong> {reserva.titulo}</p>
                {reserva.grupo_id && (
                  <p><strong>Grupo:</strong> {reserva.grupo_id.substring(0, 8)}...</p>
                )}
                <p><strong>Data:</strong> {formatarData(reserva.data)}</p>
                <p><strong>Horário:</strong> {reserva.hora_inicio} - {reserva.hora_fim}</p>
                {sala && (
                  <p><strong>Localização:</strong> Bloco {sala.bloco || '?'} | {sala.andar || 'Andar não informado'}</p>
                )}
                <p><strong>Responsável:</strong> {reserva.responsavel}</p>
                <p><strong>E-mail:</strong> {reserva.email}</p>
                {reserva.descricao && <p><strong>Descrição:</strong> {reserva.descricao}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="admin-footer">
        <Link to="/admin" className="admin-link">Área Administrativa</Link>
      </footer>
    </div>
  );
}

export default App;