import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getSalas,
  getReservas,
  createReserva,
  getDisponibilidade,
} from './api';

function App() {
  const [salas, setSalas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [disponibilidade, setDisponibilidade] = useState(null);
  const [form, setForm] = useState({
    sala_id: '',
    titulo: '',
    data: '',
    hora_inicio: '08:00',
    hora_fim: '09:00',
    responsavel: '',
    email: '',
    descricao: '',
  });
  const [erro, setErro] = useState('');
  const [toast, setToast] = useState(null); // estado para o popup
  const [reservasDoDia, setReservasDoDia] = useState([]);

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

  const disponibilidadeTexto = useMemo(() => {
    if (!disponibilidade) return null;
    return disponibilidade.horarios.map((item) => (
      <li key={`${item.hora_inicio}-${item.hora_fim}`} className={item.ocupado ? 'ocupado' : 'livre'}>
        <strong>{item.hora_inicio}</strong> - {item.hora_fim} <strong>{item.ocupado ? 'Ocupado' : 'Livre'}</strong>
      </li>
    ));
  }, [disponibilidade]);

  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const TODAS_HORAS_INICIO = Array.from({ length: 11 }, (_, i) =>
    `${String(i + 8).padStart(2, '0')}:00`
  );
  const TODAS_HORAS_FIM = Array.from({ length: 11 }, (_, i) =>
    `${String(i + 9).padStart(2, '0')}:00`
  );

  const horarioConflita = (hora, tipo) => {
    return reservasDoDia.some(({ hora_inicio, hora_fim }) => {
      const h = parseInt(hora);
      const ini = parseInt(hora_inicio);
      const fim = parseInt(hora_fim);
      if (tipo === 'inicio') return h >= ini && h < fim;
      return h > ini && h <= fim;
    });
  };

  const horasInicioDisponiveis = useMemo(() => {
    return TODAS_HORAS_INICIO.filter((h) => !horarioConflita(h, 'inicio'));
  }, [reservasDoDia]);

  const horasFimDisponiveis = useMemo(() => {
    if (!form.hora_inicio) return [];
    const inicioH = parseInt(form.hora_inicio);
    const proximaReserva = reservasDoDia
      .map((r) => parseInt(r.hora_inicio))
      .filter((h) => h > inicioH)
      .sort((a, b) => a - b)[0];
    const limite = proximaReserva !== undefined ? proximaReserva : 19;
    return TODAS_HORAS_FIM.filter((h) => {
      const hNum = parseInt(h);
      return hNum > inicioH && hNum <= limite;
    });
  }, [form.hora_inicio, reservasDoDia]);

  useEffect(() => {
    if (horasFimDisponiveis.length > 0 && !horasFimDisponiveis.includes(form.hora_fim)) {
      setForm((current) => ({ ...current, hora_fim: horasFimDisponiveis[0] }));
    }
  }, [horasFimDisponiveis]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmitReserva = async (event) => {
    event.preventDefault();
    setErro('');
    if (!form.sala_id) {
      showToast('Escolha uma sala antes de reservar', 'error');
      return;
    }
    const response = await createReserva(form);
    if (response.erro) {
      showToast(response.erro, 'error');
      return;
    }
    setForm((current) => ({ ...current, titulo: '', responsavel: '', email: '', descricao: '' }));
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

  useEffect(() => {
    if (horasFimDisponiveis.length > 0 && !horasFimDisponiveis.includes(form.hora_fim)) {
      setForm((current) => ({ ...current, hora_fim: horasFimDisponiveis[0] }));
    }
  }, [horasFimDisponiveis]);

  return (
    <div className="app-container">
      {/* Toast notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

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
            <select name="hora_inicio" value={form.hora_inicio} onChange={handleChange} required>
              {horasInicioDisponiveis.map((h) => <option key={h}>{h}</option>)}
            </select>
          </label>

          <label>
            Fim *
            <select name="hora_fim" value={form.hora_fim} onChange={handleChange} required>
              {horasFimDisponiveis.map((h) => <option key={h}>{h}</option>)}
            </select>
          </label>

          <label>
            Título *
            <input type="text" name="titulo" value={form.titulo} onChange={handleChange} required />
          </label>

          <label>
            Responsável *
            <input type="text" name="responsavel" value={form.responsavel} onChange={handleChange} required />
          </label>

          <label>
            E-mail *
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>

          <label>
            Descrição
            <textarea name="descricao" value={form.descricao} onChange={handleChange} rows="3" />
          </label>

          <div className="actions">
            <button type="submit">Reservar</button>
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
              <p><strong>Data:</strong> {new Date(reserva.data).toLocaleDateString('pt-BR')}</p>
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