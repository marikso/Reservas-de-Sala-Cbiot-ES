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

  // Estados para reserva recorrente
  const [recorrente, setRecorrente] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [dataFim, setDataFim] = useState('');

  const dataSelecionada = !!form.data;

  const loadSalas = async () => {
    const data = await getSalas();
    setSalas(data);
  };
  const loadReservas = async () => {
    const data = await getReservas();
    setReservas(data);
  };

  useEffect(() => {
    loadSalas();
    loadReservas();
  }, []);

  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const reservasIntervalos = useMemo(
    () => reservasDoDia.map((r) => ({
      inicio: timeToMinutes(r.hora_inicio),
      fim: timeToMinutes(r.hora_fim),
    })),
    [reservasDoDia]
  );

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
          `Existem conflitos nas seguintes datas: ${conflitosStr}\n\nDeseja criar as reservas apenas para as datas disponíveis? (As reservas com conflito serão ignoradas.)`
        );
        if (!userConfirmed) {
          if (response.grupo_id) {
            await deleteReservasByGrupo(response.grupo_id);
            showToast('Operação cancelada. Nenhuma reserva foi criada.', 'info');
          } else {
            showToast('Nenhuma reserva foi criada devido a conflitos.', 'error');
          }
          await loadReservas();
          return;
        } else {
          showToast(
            `${response.reservas_criadas.length} reservas criadas. Conflitos ignorados: ${response.conflitos.length}`,
            'success'
          );
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

  const selectsDisabled = !dataSelecionada && !recorrente;
  const camposTextDisabled = !dataSelecionada && !recorrente;

  const diasOptions = [
    { label: 'Segunda', value: 0 },
    { label: 'Terça', value: 1 },
    { label: 'Quarta', value: 2 },
    { label: 'Quinta', value: 3 },
    { label: 'Sexta', value: 4 },
  ];

  // Ordenar salas em ordem alfabética/numerica
  const salasOrdenadas = useMemo(() => {
    return [...salas].sort((a, b) =>
      a.nome.localeCompare(b.nome, undefined, { numeric: true })
    );
  }, [salas]);

  return (
    <div className="app-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <header>
        <div className="header-content">
          <img src="/CBiot_logo.jpg" alt="Logo CBiot" className="logo" />
          <h1 className="central-title">Sistema de Reserva de Sala do CBiot</h1>
        </div>
      </header>

      {/* Mapa de Salas - lista ordenada */}
      <section className="box mapa-salas">
        <h2>🗺️ Mapa das Salas</h2>
        <div className="salas-grid-mapa">
          {salasOrdenadas.map((sala) => (
            <div
              key={sala.id}
              className={`sala-card-mapa ${form.sala_id == sala.id ? 'selecionada' : ''}`}
              onClick={() => setForm((prev) => ({ ...prev, sala_id: sala.id }))}
            >
              <div className="sala-nome">{sala.nome}</div>
              <div className="sala-localizacao">
                📍 Bloco {sala.bloco || '?'} | Andar {sala.andar || '?'}
              </div>
              <div className="sala-info">
                <span>👥 Capacidade: {sala.capacidade || '?'} pessoas</span>
              </div>
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
            </div>
          ))}
        </div>
      </section>

      <section className="box">
        <h2>Fazer reserva</h2>
        <form onSubmit={handleSubmitReserva} className="form-grid">
          <label>
            Sala *
            <select name="sala_id" value={form.sala_id} onChange={handleChange} required>
              <option value="">Selecione uma sala</option>
              {salasOrdenadas.map((sala) => (
                <option key={sala.id} value={sala.id}>
                  {sala.nome}
                </option>
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
              {horasInicioDisponiveis.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>

          <label>
            Fim *
            <select name="hora_fim" value={form.hora_fim} onChange={handleChange} required disabled={selectsDisabled}>
              {horasFimDisponiveis.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
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
                  {diasOptions.map((day) => (
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
            <button type="submit" disabled={!dataSelecionada && !recorrente}>Reservar</button>
            <button type="button" onClick={handleDisponibilidade} className="secondary" disabled={!form.sala_id || !form.data}>
              Ver disponibilidade
            </button>
          </div>
        </form>
      </section>

      {disponibilidade && (
        <section className="box">
          <h2>Disponibilidade</h2>
          <p>Sala <strong>{disponibilidade.sala_nome}</strong> em <strong>{formatarData(disponibilidade.data)}</strong></p>
          <ul className="grid-list">
            {disponibilidade.horarios.map((item) => (
              <li key={`${item.hora_inicio}-${item.hora_fim}`} className={item.ocupado ? 'ocupado' : 'livre'}>
                <strong>{item.hora_inicio}</strong> - {item.hora_fim} <strong>{item.ocupado ? 'Ocupado' : 'Livre'}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="box">
  <h2>Reservas Confirmadas</h2>
  <div className="reservas-grid">
    {reservas.map((reserva) => {
      const sala = salas.find(s => s.id === reserva.sala_id);
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