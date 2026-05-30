import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getSalas,
  getReservas,
  createReserva,
  getDisponibilidade,
} from './api';

// ========== FUNÇÕES AUXILIARES DE HORÁRIO ==========
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
  let mins = timeToMinutes(timeStr);
  mins += 30;
  return minutesToTime(mins);
};

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
    () =>
      reservasDoDia.map((r) => ({
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
    if (!dataSelecionada) return [];
    return todosInicios.filter((inicio) => {
      const fim = add30min(inicio);
      return !conflita(timeToMinutes(inicio), timeToMinutes(fim));
    });
  }, [todosInicios, dataSelecionada, reservasIntervalos]);

  const horasFimDisponiveis = useMemo(() => {
    if (!dataSelecionada || !form.hora_inicio) return [];
    const inicioMin = timeToMinutes(form.hora_inicio);
    const proximosInicios = reservasIntervalos
      .map((r) => r.inicio)
      .filter((min) => min > inicioMin)
      .sort((a, b) => a - b);
    const limite = proximosInicios.length ? proximosInicios[0] : 19 * 60;
    return todosFins.filter((fimStr) => {
      const fimMin = timeToMinutes(fimStr);
      return fimMin > inicioMin && fimMin <= limite;
    });
  }, [form.hora_inicio, todosFins, dataSelecionada, reservasIntervalos]);

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
    if (!dataSelecionada) {
      showToast('Selecione uma data antes de reservar', 'error');
      return;
    }
    const response = await createReserva(form);
    if (response.erro) {
      showToast(response.erro, 'error');
      return;
    }
    setForm((prev) => ({ ...prev, titulo: '', responsavel: '', email: '', descricao: '' }));
    await loadReservas();
    showToast('Reserva criada com sucesso!', 'success');
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
        const ocupados = response.horarios.filter((h) => h.ocupado);
        setReservasDoDia(ocupados);
      }
    });
  }, [form.sala_id, form.data]);

  const selectsDisabled = !dataSelecionada;
  const camposTextDisabled = !dataSelecionada;

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
            <input type="date" name="data" value={form.data} onChange={handleChange} required />
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
          <div className="actions">
            <button type="submit" disabled={!dataSelecionada}>Reservar</button>
            <button type="button" onClick={handleDisponibilidade} className="secondary">Ver disponibilidade</button>
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