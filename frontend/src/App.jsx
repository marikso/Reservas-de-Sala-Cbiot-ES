import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getSalas,
  getReservas,
  createReserva,
  createReservaRecorrente,
  getDisponibilidade,
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

const add30min = (timeStr) => {
  return minutesToTime(timeToMinutes(timeStr) + 30);
};

const generateAllStartTimes = () => {
  const times = [];
  let mins = 8 * 60; // 08:00
  while (mins < 19 * 60) {
    times.push(minutesToTime(mins));
    mins += 30;
  }
  return times;
};

const generateAllEndTimes = () => {
  const times = [];
  let mins = 8 * 60 + 30; // 08:30
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
  const [diasSelecionados, setDiasSelecionados] = useState([]); // [0,1,2,3,4] (segunda a sexta)
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
      return todosFins.filter((fimStr) => {
        const fimMin = timeToMinutes(fimStr);
        return fimMin > inicioMin;
      });
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
    // Não há validação de fim de semana no frontend (deixamos o backend fazer)
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
        dias_semana: diasSelecionados, // array ex: [1,3] para terça e quinta
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
    } else if (response.mensagem) {
      showToast(response.mensagem, 'success');
      if (response.conflitos && response.conflitos.length) {
        showToast(`Conflitos nas datas: ${response.conflitos.join(', ')}`, 'error');
      }
      await loadReservas();
    } else {
      setForm((prev) => ({ ...prev, titulo: '', responsavel: '', email: '', descricao: '' }));
      await loadReservas();
      showToast('Reserva criada com sucesso!', 'success');
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

  // Atualiza reservas do dia quando sala ou data mudam (apenas para reserva pontual)
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

  // Dias úteis (apenas segunda a sexta)
  const diasOptions = [
    { label: 'Segunda', value: 0 },
    { label: 'Terça', value: 1 },
    { label: 'Quarta', value: 2 },
    { label: 'Quinta', value: 3 },
    { label: 'Sexta', value: 4 },
  ];

  return (
    <div className="app-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <header>
        <div className="header-content">
          <img src="/CBiot_logo.jpg" alt="Logo CBiot" className="logo" />
          <h1 className="central-title">Sistema de Reserva de Sala do CBiot</h1>
        </div>
      </header>

      <section className="box">
        <h2>Fazer reserva</h2>
        <form onSubmit={handleSubmitReserva} className="form-grid">
          <label>
            Sala *
            <select name="sala_id" value={form.sala_id} onChange={handleChange} required>
              <option value="">Selecione uma sala</option>
              {salas.map((sala) => (
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

          {/* Opção de reserva recorrente */}
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
                  {diasOptions.map(day => (
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
                            setDiasSelecionados(diasSelecionados.filter(d => d !== val));
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
          {reservas.map((reserva) => (
            <div className="reserva-card" key={reserva.id}>
              <h3>{reserva.sala_nome} - {reserva.titulo}</h3>
              <p><strong>Data:</strong> {formatarData(reserva.data)}</p>
              <p><strong>Horário:</strong> {reserva.hora_inicio} - {reserva.hora_fim}</p>
              {reserva.responsavel && <p><strong>Responsável:</strong> {reserva.responsavel}</p>}
              {reserva.email && <p><strong>E-mail:</strong> {reserva.email}</p>}
              {reserva.descricao && <p><strong>Descrição:</strong> {reserva.descricao}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer className="admin-footer">
        <Link to="/admin" className="admin-link">Área Administrativa</Link>
      </footer>
    </div>
  );
}

export default App;