import { useEffect, useMemo, useState } from 'react';
import {
  getSalas,
  getReservas,
  createReserva,
  createSala,
  deleteSala,
  deleteReserva,
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
  const [novaSala, setNovaSala] = useState('');
  const [erro, setErro] = useState('');
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
        <strong>{item.hora_inicio}</strong> - {item.hora_fim} {item.ocupado ? '(Ocupado)' : '(Livre)'}
      </li>
    ));
  }, [disponibilidade]);

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

  const handleSubmitReserva = async (event) => {
    event.preventDefault();
    setErro('');
    if (!form.sala_id) {
      setErro('Escolha uma sala antes de reservar');
      return;
    }

    const response = await createReserva(form);
    if (response.erro) {
      setErro(response.erro);
      return;
    }

    setForm((current) => ({ ...current, titulo: '', responsavel: '', email: '', descricao: '' }));
    await loadReservas();
    setErro('Reserva criada com sucesso!');
  };

  const handleDisponibilidade = async () => {
    if (!form.sala_id || !form.data) {
      setErro('Escolha sala e data para ver disponibilidade');
      return;
    }
    const response = await getDisponibilidade(form.sala_id, form.data);
    if (response.erro) {
      setErro(response.erro);
      return;
    }
    setDisponibilidade(response);
  };

  const handleAdicionarSala = async () => {
    if (!novaSala.trim()) return;
    const response = await createSala(novaSala.trim());
    if (response.erro) {
      setErro(response.erro);
      return;
    }
    setNovaSala('');
    await loadSalas();
  };

  const handleDeletarSala = async (id) => {
    await deleteSala(id);
    await loadSalas();
    await loadReservas();
  };

  const handleDeletarReserva = async (id) => {
    await deleteReserva(id);
    await loadReservas();
  };

  const HORAS_INICIO = Array.from({ length: 11 }, (_, i) => {
  const h = i + 8;
  return `${String(h).padStart(2, '0')}:00`;
}); // ['08:00', '09:00', ..., '18:00']

const horasFim = useMemo(() => {
  if (!form.hora_inicio) return [];
  const horaMin = parseInt(form.hora_inicio.split(':')[0]) + 1;
  return Array.from({ length: 19 - horaMin + 1 }, (_, i) => {
    const h = horaMin + i;
    return `${String(h).padStart(2, '0')}:00`;
  });
}, [form.hora_inicio]);

useEffect(() => {
  const horaMin = parseInt(form.hora_inicio.split(':')[0]) + 1;
  const fimAtual = parseInt(form.hora_fim.split(':')[0]);
  if (fimAtual <= parseInt(form.hora_inicio.split(':')[0])) {
    setForm((current) => ({ ...current, hora_fim: `${String(horaMin).padStart(2, '0')}:00` }));
  }
}, [form.hora_inicio]);

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
      <header>
        <h1>ReservaSala</h1>
        <p>App em React com backend Node.js</p>
      </header>

      <section className="box">
        <h2>Fazer reserva</h2>
        <form onSubmit={handleSubmitReserva}>
          <label>
            Sala
            <select name="sala_id" value={form.sala_id} onChange={handleChange}>
              <option value="">Selecione uma sala</option>
              {salas.map((sala) => (
                <option key={sala.id} value={sala.id}>
                  {sala.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            Data
            <input type="date" name="data" value={form.data} onChange={handleChange} />
          </label>

          <label>
            Início
            <select name="hora_inicio" value={form.hora_inicio} onChange={handleChange}>
                {horasInicioDisponiveis.map((h) => (
                <option key={h} value={h}>{h}</option>
            ))}
            </select>
          </label>

          <label>
            Fim
            <select name="hora_fim" value={form.hora_fim} onChange={handleChange}>
                {horasFimDisponiveis.map((h) => (
                <option key={h} value={h}>{h}</option>
                ))}
            </select>
          </label>

          <label>
            Título
            <input type="text" name="titulo" value={form.titulo} onChange={handleChange} />
          </label>

          <label>
            Responsável
            <input type="text" name="responsavel" value={form.responsavel} onChange={handleChange} />
          </label>

          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} />
          </label>

          <label>
            Descrição
            <textarea name="descricao" value={form.descricao} onChange={handleChange} />
          </label>

          <div className="actions">
            <button type="submit">Reservar</button>
            <button type="button" onClick={handleDisponibilidade} className="secondary">
              Ver disponibilidade
            </button>
          </div>
        </form>
      </section>

      <section className="box">
        <h2>Administração</h2>
        <div className="admin-row">
          <input
            type="text"
            placeholder="Nome da nova sala"
            value={novaSala}
            onChange={(event) => setNovaSala(event.target.value)}
          />
          <button type="button" onClick={handleAdicionarSala}>
            Adicionar sala
          </button>
        </div>

        <ul className="list">
          {salas.map((sala) => (
            <li key={sala.id}>
              {sala.nome}
              <button type="button" onClick={() => handleDeletarSala(sala.id)}>
                Excluir
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="box">
        <h2>Reservas</h2>
        <ul className="list">
          {reservas.map((reserva) => (
            <li key={reserva.id}>
              <strong>{reserva.titulo}</strong> — {reserva.sala_nome} em {reserva.data} das {reserva.hora_inicio} às {reserva.hora_fim}
              <button type="button" onClick={() => handleDeletarReserva(reserva.id)}>
                Cancelar
              </button>
            </li>
          ))}
        </ul>
      </section>

      {erro && <div className="message">{erro}</div>}

      {disponibilidade && (
        <section className="box">
          <h2>Disponibilidade</h2>
          <p>
            Sala <strong>{disponibilidade.sala_nome}</strong> em <strong>{disponibilidade.data}</strong>
          </p>
          <ul className="grid-list">{disponibilidadeTexto}</ul>
        </section>
      )}
    </div>
  );
}

export default App;
