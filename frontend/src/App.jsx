import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSalas,
  createSala,
  updateSala,
  deleteSala,
  getReservas,
  createReserva,
  createReservaRecorrente,
  getDisponibilidade,
  deleteReservasByGrupo,
  deleteReserva,
  deleteUserGrupo,
  updateReserva,
  getUsers,
  updateUser,
  approveUser,
  whoami,
  authLogout,
} from './api';

import ReservaModal from './components/ReservaModal';

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
  const [allReservas, setAllReservas] = useState([]);
  const [users, setUsers] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [rejeitadas, setRejeitadas] = useState([]);
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
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const [recorrente, setRecorrente] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [dataFim, setDataFim] = useState('');

  const [tabSolicitacoes, setTabSolicitacoes] = useState('pendentes');

  const [modoDisponibilidade, setModoDisponibilidade] = useState('sala');
  const [disponibilidadeDataHora, setDisponibilidadeDataHora] = useState(null);
  const [dataConsulta, setDataConsulta] = useState('');
  const [horaConsulta, setHoraConsulta] = useState('08:00');
  const [horaFimConsulta, setHoraFimConsulta] = useState('08:30');

  const [editandoReserva, setEditandoReserva] = useState(null);
  const [editForm, setEditForm] = useState({
    titulo: '',
    descricao: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
  });

  const [novaSala, setNovaSala] = useState({
    nome: '',
    bloco: '',
    andar: '',
    capacidade: '',
    equipamentos: '',
  });
  const [editandoSala, setEditandoSala] = useState(null);

  const [activeView, setActiveView] = useState('inicio');
  const [selectedCargo, setSelectedCargo] = useState({});

  // Estados para seleção de intervalo na consulta de disponibilidade
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);

  // Estado para armazenar dados da reserva a ser preenchida no modal
  const [reservaData, setReservaData] = useState({
    sala_id: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
    titulo: '',
  });

  // Estado para o modal de reserva
  const [modalReservaAberto, setModalReservaAberto] = useState(false);

  const dataSelecionada = !!form.data;

  // ========== CARREGAMENTO INICIAL ==========
  const loadSalas = async () => {
    const data = await getSalas();
    setSalas(data);
  };
  const loadReservas = async () => {
    const data = await getReservas();
    const hoje = new Date().toISOString().slice(0, 10);
    const minhasReservas = data.filter((r) => r.data >= hoje && r.email === currentUser?.email);
    setReservas(minhasReservas);
  };
  const loadAllReservas = async () => {
    const data = await getReservas();
    const hoje = new Date().toISOString().slice(0, 10);
    const todas = data.filter((r) => r.data >= hoje);
    setAllReservas(todas);
  };
  const loadUsers = async () => {
    if (currentUser?.cargo === 'admin') {
      const data = await getUsers();
      setUsers(data);
    }
  };
  const loadSolicitacoes = async () => {
    if (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente') {
      const res = await fetch('http://localhost:5000/api/solicitacoes', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSolicitacoes(data);
      }
    }
  };
  const loadRejeitadas = async () => {
    if (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente') {
      const res = await fetch('http://localhost:5000/api/solicitacoes/rejeitadas', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRejeitadas(data);
      }
    }
  };

  useEffect(() => {
    loadSalas();
    whoami()
      .then((u) => {
        if (u && u.email) {
          setCurrentUser(u);
          setForm((prev) => ({
            ...prev,
            responsavel: u.nome || '',
            email: u.email,
          }));
        } else {
          navigate('/');
        }
      })
      .catch(() => navigate('/'));
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadReservas();
      if (currentUser.cargo === 'admin' || currentUser.cargo === 'gerente') {
        loadAllReservas();
        loadSolicitacoes();
        loadRejeitadas();
      }
      if (currentUser.cargo === 'admin') {
        loadUsers();
      }
    }
  }, [currentUser]);

  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  // ========== LÓGICA DE HORÁRIOS DISPONÍVEIS (formulário) ==========
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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    await authLogout();
    setCurrentUser(null);
    showToast('Desconectado', 'info');
    navigate('/');
  };

  const handleCancelarReserva = async (id, titulo) => {
    if (window.confirm(`Cancelar a reserva "${titulo}"?`)) {
      const res = await deleteReserva(id);
      if (res.erro) showToast(res.erro, 'error');
      else {
        showToast('Reserva cancelada', 'success');
        if (activeView === 'minhas-reservas') await loadReservas();
        else if (activeView === 'admin-reservas') await loadAllReservas();
      }
    }
  };

  const handleCancelarGrupo = async (grupoId, isOwner = false) => {
    if (window.confirm('Cancelar TODAS as reservas desta série recorrente?')) {
      let res;
      if (isOwner) {
        res = await deleteUserGrupo(grupoId);
      } else {
        res = await deleteReservasByGrupo(grupoId);
      }
      if (res.erro) showToast(res.erro, 'error');
      else {
        showToast(res.mensagem, 'success');
        if (activeView === 'minhas-reservas') await loadReservas();
        else if (activeView === 'admin-reservas') await loadAllReservas();
      }
    }
  };

  const handleEditarReserva = (reserva) => {
    setEditandoReserva(reserva);
    setEditForm({
      titulo: reserva.titulo,
      descricao: reserva.descricao || '',
      data: reserva.data,
      hora_inicio: reserva.hora_inicio,
      hora_fim: reserva.hora_fim,
    });
  };

  const handleUpdateReserva = async () => {
    if (!editandoReserva) return;
    const payload = {
      titulo: editForm.titulo,
      descricao: editForm.descricao,
      data: editForm.data,
      hora_inicio: editForm.hora_inicio,
      hora_fim: editForm.hora_fim,
    };
    const res = await updateReserva(editandoReserva.id, payload);
    if (res.erro) showToast(res.erro, 'error');
    else {
      showToast('Reserva atualizada!', 'success');
      setEditandoReserva(null);
      if (activeView === 'minhas-reservas') await loadReservas();
      else if (activeView === 'admin-reservas') await loadAllReservas();
    }
  };

  // ========== DISPONIBILIDADE (para view separada) ==========
  const handleDisponibilidade = async () => {
    if (!form.sala_id || !form.data) {
      showToast('Escolha sala e data para ver disponibilidade', 'error');
      return;
    }
    // Reset selection when fetching new availability
    setSelectedStart(null);
    setSelectedEnd(null);
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

  const handleConsultarDisponibilidadeDataHora = async () => {
    if (!dataConsulta || !horaConsulta || !horaFimConsulta) {
      showToast('Selecione data, início e fim', 'error');
      return;
    }
    const res = await fetch(
      `http://localhost:5000/api/salas/disponiveis?data=${dataConsulta}&hora_inicio=${horaConsulta}&hora_fim=${horaFimConsulta}`,
      { credentials: 'include' }
    );
    const data = await res.json();
    if (res.ok) {
      setDisponibilidadeDataHora(data);
    } else {
      showToast(data.erro || 'Erro na consulta', 'error');
    }
  };

  // ========== GERENCIAMENTO DE SALAS (admin) ==========
  const handleChangeSala = (e) => {
    const { name, value } = e.target;
    setNovaSala((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdicionarSala = async () => {
    if (!novaSala.nome.trim()) {
      showToast('Informe o nome da sala', 'error');
      return;
    }
    const res = await createSala(novaSala);
    if (res.erro) showToast(res.erro, 'error');
    else {
      setNovaSala({ nome: '', bloco: '', andar: '', capacidade: '', equipamentos: '' });
      await loadSalas();
      showToast('Sala criada com sucesso!');
    }
  };

  const handleEditarSala = (sala) => {
    setEditandoSala(sala);
    setNovaSala({
      nome: sala.nome,
      bloco: sala.bloco || '',
      andar: sala.andar || '',
      capacidade: sala.capacidade || '',
      equipamentos: sala.equipamentos || '',
    });
  };

  const handleCancelarEdicaoSala = () => {
    setEditandoSala(null);
    setNovaSala({ nome: '', bloco: '', andar: '', capacidade: '', equipamentos: '' });
  };

  const handleUpdateSala = async () => {
    if (!novaSala.nome.trim()) {
      showToast('Informe o nome da sala', 'error');
      return;
    }
    const res = await updateSala(editandoSala.id, novaSala);
    if (res.erro) showToast(res.erro, 'error');
    else {
      showToast(`Sala "${novaSala.nome}" atualizada!`, 'success');
      setEditandoSala(null);
      setNovaSala({ nome: '', bloco: '', andar: '', capacidade: '', equipamentos: '' });
      await loadSalas();
    }
  };

  const handleDeletarSala = async (id, nome) => {
    if (window.confirm(`Excluir a sala "${nome}"? Todas as reservas associadas também serão removidas.`)) {
      await deleteSala(id);
      await loadSalas();
      await loadAllReservas();
      showToast(`Sala "${nome}" excluída!`);
    }
  };

  const handleUpdateUser = async (userId, data) => {
    const res = await updateUser(userId, data);
    if (res.erro) showToast(res.erro, 'error');
    else {
      showToast('Usuário atualizado', 'success');
      loadUsers();
    }
  };

  const handleApproveUser = async (userId, cargo) => {
    const res = await approveUser(userId, cargo);
    if (res.erro) showToast(res.erro, 'error');
    else {
      showToast('Usuário aprovado', 'success');
      loadUsers();
    }
  };

  const handleAprovarSolicitacao = async (id) => {
    const res = await fetch(`http://localhost:5000/api/solicitacoes/${id}/aprovar`, { method: 'POST', credentials: 'include' });
    if (res.ok) {
      showToast('Reserva aprovada!', 'success');
      loadSolicitacoes();
      loadAllReservas();
    } else {
      const err = await res.json();
      showToast(err.erro || 'Erro ao aprovar', 'error');
    }
  };

  const handleRejeitarSolicitacao = async (id) => {
    if (window.confirm('Rejeitar esta solicitação?')) {
      const res = await fetch(`http://localhost:5000/api/solicitacoes/${id}/rejeitar`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        showToast('Solicitação rejeitada', 'success');
        loadSolicitacoes();
        loadRejeitadas();
      } else {
        const err = await res.json();
        showToast(err.erro || 'Erro ao rejeitar', 'error');
      }
    }
  };

  const salasOrdenadas = useMemo(() => {
    return [...salas].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));
  }, [salas]);

  if (!currentUser) return <div>Carregando...</div>;

  // ========== RENDERIZAÇÃO DAS VIEWS ==========
  const renderMainContent = () => {
    // VIEW INÍCIO
    if (activeView === 'inicio') {
      return (
        <>
          <section className="box mapa-salas">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>🗺️ Mapa das Salas</h2>
              <button className="solicitar-reserva-btn" onClick={() => setModalReservaAberto(true)}>
                + Solicitar Reserva
              </button>
            </div>
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
        </>
      );
    }

    // MINHAS RESERVAS
    if (activeView === 'minhas-reservas') {
      return (
        <section className="box">
          <h2>📋 Minhas Reservas</h2>
          {reservas.length === 0 && <p>Você não possui reservas.</p>}
          <div className="reservas-grid">
            {reservas.map((reserva) => {
              const sala = salas.find((s) => s.id === reserva.sala_id);
              const isOwner = reserva.email === currentUser?.email;
              return (
                <div className="reserva-card" key={reserva.id}>
                  <h3>{reserva.sala_nome} · {reserva.titulo}</h3>
                  {reserva.grupo_id && <p><strong>Grupo:</strong> {reserva.grupo_id.substring(0, 8)}...</p>}
                  <p><strong>Data:</strong> {formatarData(reserva.data)}</p>
                  <p><strong>Horário:</strong> {reserva.hora_inicio} - {reserva.hora_fim}</p>
                  {sala && <p><strong>Localização:</strong> Bloco {sala.bloco || '?'} | {sala.andar || 'Andar não informado'}</p>}
                  <p><strong>Solicitante:</strong> {reserva.responsavel}</p>
                  <p><strong>E-mail:</strong> {reserva.email}</p>
                  {reserva.descricao && <p>{reserva.descricao}</p>}
                  {reserva.status === 'aprovada' && reserva.aprovador && (
                    <p><strong>Aprovado por:</strong> {reserva.aprovador} em {new Date(reserva.data_aprovacao).toLocaleString()}</p>
                  )}
                  <div className="reserva-actions">
                    {(currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente') && (
                      <button className="edit-btn" onClick={() => handleEditarReserva(reserva)}>Editar</button>
                    )}
                    {reserva.grupo_id && (
                      <button className="cancel-group-btn" onClick={() => handleCancelarGrupo(reserva.grupo_id, isOwner)}>Cancelar série</button>
                    )}
                    <button className="cancel-btn" onClick={() => handleCancelarReserva(reserva.id, reserva.titulo)}>Cancelar reserva</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    // GERENCIAR RESERVAS (admin/gerente)
    if (activeView === 'admin-reservas' && (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente')) {
      return (
        <section className="box">
          <h2>📋 Gerenciar Reservas</h2>
          {allReservas.length === 0 && <p>Nenhuma reserva futura encontrada.</p>}
          <div className="reservas-grid">
            {allReservas.map((reserva) => {
              const sala = salas.find((s) => s.id === reserva.sala_id);
              return (
                <div className="reserva-card" key={reserva.id}>
                  <h3>{reserva.sala_nome} · {reserva.titulo}</h3>
                  {reserva.grupo_id && <p><strong>Grupo:</strong> {reserva.grupo_id.substring(0, 8)}...</p>}
                  <p><strong>Data:</strong> {formatarData(reserva.data)}</p>
                  <p><strong>Horário:</strong> {reserva.hora_inicio} - {reserva.hora_fim}</p>
                  {sala && <p><strong>Localização:</strong> Bloco {sala.bloco || '?'} | {sala.andar || 'Andar não informado'}</p>}
                  <p><strong>Solicitante:</strong> {reserva.responsavel}</p>
                  <p><strong>E-mail:</strong> {reserva.email}</p>
                  {reserva.descricao && <p>{reserva.descricao}</p>}
                  {reserva.status === 'aprovada' && reserva.aprovador && (
                    <p><strong>Aprovado por:</strong> {reserva.aprovador} em {new Date(reserva.data_aprovacao).toLocaleString()}</p>
                  )}
                  <div className="reserva-actions">
                    <button className="edit-btn" onClick={() => handleEditarReserva(reserva)}>Editar</button>
                    {reserva.grupo_id && (
                      <button className="cancel-group-btn" onClick={() => handleCancelarGrupo(reserva.grupo_id, false)}>Cancelar série</button>
                    )}
                    <button className="cancel-btn" onClick={() => handleCancelarReserva(reserva.id, reserva.titulo)}>Cancelar reserva</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    // CONSULTAR DISPONIBILIDADE
    if (activeView === 'consultar-disponibilidade') {
      return (
        <section className="box disponibilidade-box">
          <div className="disponibilidade-header">
            <div>
              <h2>Consultar disponibilidade</h2>
              <p className="disponibilidade-sub">Clique em um horário disponível para solicitar reserva · blocos de 30 min.</p>
            </div>
          </div>

          <div className="modo-consulta">
            <label className={`modo-radio ${modoDisponibilidade === 'sala' ? 'active' : ''}`}>
              <input type="radio" value="sala" checked={modoDisponibilidade === 'sala'} onChange={() => setModoDisponibilidade('sala')} />
              <span>Por sala e data</span>
            </label>
            <label className={`modo-radio ${modoDisponibilidade === 'data_hora' ? 'active' : ''}`}>
              <input type="radio" value="data_hora" checked={modoDisponibilidade === 'data_hora'} onChange={() => setModoDisponibilidade('data_hora')} />
              <span>Por data e hora (intervalo)</span>
            </label>
          </div>

          {modoDisponibilidade === 'sala' ? (
            <div className="consulta-sala">
              <div className="consulta-field">
                <label>SALA</label>
                <select value={form.sala_id} onChange={(e) => setForm((prev) => ({ ...prev, sala_id: e.target.value }))}>
                  <option value="">Selecione uma sala</option>
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="consulta-field">
                <label>DATA</label>
                <input type="date" value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} />
              </div>
              <button className="consulta-btn" onClick={handleDisponibilidade}>Ver disponibilidade</button>
            </div>
          ) : (
            <div className="consulta-data-hora">
              <div className="consulta-field">
                <label>Data</label>
                <input type="date" value={dataConsulta} onChange={(e) => setDataConsulta(e.target.value)} />
              </div>
              <div className="consulta-field">
                <label>Início</label>
                <select value={horaConsulta} onChange={(e) => setHoraConsulta(e.target.value)}>
                  {todosInicios.map((h) => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div className="consulta-field">
                <label>Fim</label>
                <select value={horaFimConsulta} onChange={(e) => setHoraFimConsulta(e.target.value)}>
                  {todosFins.filter((f) => timeToMinutes(f) > timeToMinutes(horaConsulta)).map((h) => <option key={h}>{h}</option>)}
                </select>
              </div>
              <button className="consulta-btn" onClick={handleConsultarDisponibilidadeDataHora}>Buscar salas disponíveis</button>
            </div>
          )}

          {modoDisponibilidade === 'sala' && disponibilidade && (
            <div className="resultado-disponibilidade">
              {(() => {
                const salaSelecionada = salas.find(s => Number(s.id) === Number(form.sala_id));
                return (
                  <div className="sala-info-header">
                    <h3>{salaSelecionada?.nome || disponibilidade.sala_nome}</h3>
                    <p className="sala-info-detalhes">
                      Capacidade: {salaSelecionada?.capacidade || '?'} pessoas
                      {salaSelecionada?.andar && ` · Andar: ${salaSelecionada.andar}`}
                    </p>
                    {salaSelecionada?.equipamentos && (
                      <p className="sala-info-detalhes">
                        Equipamentos: {salaSelecionada.equipamentos}
                      </p>
                    )}
                    <p className="sala-mensagem">🔑 Lembre-se: a chave da sala é retirada e devolvida na portaria. Controles remotos devem permanecer na sala.</p>
                  </div>
                );
              })()}
              <p className="horario-titulo">Horários · 08:00 às 19:00 · blocos de 30 min</p>
              <div className="horarios-grade">
                {disponibilidade.horarios.map((item, idx) => {
                  let statusClass = '';
                  let statusText = '';
                  let isSelected = false;

                  if (item.ocupado) {
                    if (item.titulo?.startsWith('Manutenção')) {
                      statusClass = 'status-manutencao';
                      statusText = 'MANUTENÇÃO';
                    } else {
                      statusClass = 'status-reservado';
                      statusText = 'RESERVADO';
                    }
                  } else {
                    statusClass = 'status-disponivel';
                    statusText = 'DISPONÍVEL';
                    // Check if this time is within selected interval
                    if (selectedStart && selectedEnd) {
                      const startTime = selectedStart.hora_inicio;
                      const endTime = selectedEnd.hora_inicio;
                      if (item.hora_inicio >= startTime && item.hora_inicio <= endTime) {
                        isSelected = true;
                      }
                    } else if (selectedStart && !selectedEnd && item.hora_inicio === selectedStart.hora_inicio) {
                      isSelected = true;
                    }
                  }

                  if (isSelected && !item.ocupado) {
                    statusClass = 'status-selecionado';
                    statusText = 'SELECIONADO';
                  }

                  return (
                    <div
                      key={`${item.hora_inicio}-${item.hora_fim}`}
                      className={`horario-card ${statusClass}`}
                      onClick={() => {
                        if (item.ocupado) return;
                        if (!selectedStart) {
                          setSelectedStart(item);
                          setSelectedEnd(null);
                        } else if (!selectedEnd) {
                          if (item.hora_inicio > selectedStart.hora_inicio) {
                            setSelectedEnd(item);
                          } else {
                            setSelectedStart(item);
                            setSelectedEnd(null);
                          }
                        } else {
                          setSelectedStart(item);
                          setSelectedEnd(null);
                        }
                      }}
                    >
                      <span className="horario-inicio">{item.hora_inicio}</span>
                      <span className="horario-status">{statusText}</span>
                    </div>
                  );
                })}
              </div>
              <div className="disponibilidade-legenda">
                <div className="legenda-item"><span className="legenda-cor disponivel"></span> Disponível</div>
                <div className="legenda-item"><span className="legenda-cor reservado"></span> Reservado</div>
                <div className="legenda-item"><span className="legenda-cor manutencao"></span> Manutenção</div>
                <div className="legenda-item"><span className="legenda-cor selecionado"></span> Selecionado</div>
              </div>
              <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                <button
                  className="solicitar-reserva-btn"
                  onClick={() => {
                    if (selectedStart && selectedEnd) {
                      setReservaData({
                        sala_id: form.sala_id,
                        data: form.data,
                        hora_inicio: selectedStart.hora_inicio,
                        hora_fim: selectedEnd.hora_fim,
                        titulo: '',
                      });
                      setModalReservaAberto(true);
                    } else if (selectedStart && !selectedEnd) {
                      const endItem = disponibilidade.horarios.find(h => h.hora_inicio === selectedStart.hora_inicio);
                      setReservaData({
                        sala_id: form.sala_id,
                        data: form.data,
                        hora_inicio: selectedStart.hora_inicio,
                        hora_fim: endItem ? endItem.hora_fim : add30min(selectedStart.hora_inicio),
                        titulo: '',
                      });
                      setModalReservaAberto(true);
                    } else {
                      alert('Selecione um intervalo de horários (clique no início e depois no fim).');
                    }
                  }}
                >
                  + Solicitar Reserva
                </button>
              </div>
            </div>
          )}

          {modoDisponibilidade === 'data_hora' && disponibilidadeDataHora && (
            <div className="resultado-disponibilidade">
              <h3>Salas disponíveis em {formatarData(dataConsulta)} das {horaConsulta} às {horaFimConsulta}</h3>
              {disponibilidadeDataHora.length === 0 ? (
                <p className="sem-resultados">Nenhuma sala disponível nesse horário.</p>
              ) : (
                <div className="salas-disponiveis-grid">
                  {disponibilidadeDataHora.map((sala) => (
                    <div key={sala.id} className="sala-card-horario" onClick={() => {
                      setReservaData({
                        sala_id: sala.id,
                        data: dataConsulta,
                        hora_inicio: horaConsulta,
                        hora_fim: horaFimConsulta,
                        titulo: '',
                      });
                      setModalReservaAberto(true);
                    }}>
                      <div className="sala-nome">{sala.nome}</div>
                      <div className="sala-localizacao">📍 Bloco {sala.bloco || '?'} | {sala.andar || '?'}</div>
                      <div className="sala-info">👥 Capacidade: {sala.capacidade || '?'}</div>
                      {sala.equipamentos && <div className="sala-equipamentos">📋 {sala.equipamentos}</div>}
                      <button className="small-btn">Selecionar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      );
    }

    // GERENCIAR SALAS (admin)
    if (activeView === 'gerenciar-salas' && currentUser?.cargo === 'admin') {
      return (
        <section className="box">
          <h2>📋 Gerenciar Salas</h2>
          <div className="admin-sala-form">
            <input name="nome" placeholder="Nome da sala (obrigatório)" value={novaSala.nome} onChange={handleChangeSala} />
            <input name="bloco" placeholder="Bloco (ex: 43431)" value={novaSala.bloco} onChange={handleChangeSala} />
            <select name="andar" value={novaSala.andar} onChange={handleChangeSala}>
              <option value="">Selecione o andar</option>
              <option value="1° andar">1° andar</option>
              <option value="2° andar">2° andar</option>
            </select>
            <input name="capacidade" placeholder="Capacidade (pessoas)" type="number" value={novaSala.capacidade} onChange={handleChangeSala} />
            <textarea name="equipamentos" placeholder="Equipamentos (separados por vírgula)" value={novaSala.equipamentos} onChange={handleChangeSala} rows="2" />
            {editandoSala ? (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={handleUpdateSala}>Salvar alterações</button>
                <button onClick={handleCancelarEdicaoSala} className="secondary">Cancelar</button>
              </div>
            ) : (
              <button onClick={handleAdicionarSala}>Adicionar sala</button>
            )}
          </div>

          <div className="salas-grid-mapa">
            {salas.map((sala) => (
              <div key={sala.id} className="sala-card-mapa">
                <div className="sala-nome">{sala.nome}</div>
                <div className="sala-localizacao">📍 Bloco {sala.bloco || '?'} | {sala.andar || 'Andar não informado'}</div>
                <div className="sala-info">👥 Capacidade: {sala.capacidade || '?'} pessoas</div>
                {sala.equipamentos && (
                  <div className="sala-equipamentos">
                    <strong>📋 Equipamentos:</strong>
                    <ul>{sala.equipamentos.split(',').map((item, idx) => <li key={idx}>{item.trim()}</li>)}</ul>
                  </div>
                )}
                {sala.em_manutencao && <div className="sala-manutencao-badge">🔧 Em manutenção</div>}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="edit-sala-btn" onClick={() => handleEditarSala(sala)}>Editar</button>
                  <button className="delete-sala-btn" onClick={() => handleDeletarSala(sala.id, sala.nome)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }

    // GERENCIAR USUÁRIOS (admin)
    if (activeView === 'gerenciar-usuarios' && currentUser?.cargo === 'admin') {
      return (
        <section className="box">
          <h2>👥 Gerenciar Usuários</h2>
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.cargo} onChange={(e) => handleUpdateUser(u.id, { cargo: e.target.value })}>
                        <option value="admin">Admin</option>
                        <option value="gerente">Gerente</option>
                        <option value="usuario_comum">Usuário comum</option>
                        <option value="usuario_externo">Usuário externo</option>
                      </select>
                    </td>
                    <td>{u.status}</td>
                    <td>
                      {u.status === 'pendente' && (
                        <>
                          <button className="small-btn" onClick={() => handleApproveUser(u.id, u.cargo)}>Aprovar</button>
                          <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Rejeitar</button>
                        </>
                      )}
                      {u.status === 'aprovado' && (
                        <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Bloquear</button>
                      )}
                      {u.status === 'rejeitado' && (
                        <button className="small-btn" onClick={() => handleUpdateUser(u.id, { status: 'aprovado' })}>Reativar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p>Nenhum usuário cadastrado.</p>}
          </div>
        </section>
      );
    }

    // SOLICITAÇÕES DE RESERVA (admin/gerente)
    if (activeView === 'solicitacoes-reserva' && (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente')) {
      return (
        <section className="box">
          <h2>📋 Solicitações de Reserva</h2>
          <div className="modo-consulta" style={{ marginBottom: '1rem' }}>
            <button
              className={`small-btn ${tabSolicitacoes === 'pendentes' ? 'active' : ''}`}
              onClick={() => setTabSolicitacoes('pendentes')}
            >Pendentes</button>
            <button
              className={`small-btn ${tabSolicitacoes === 'rejeitadas' ? 'active' : ''}`}
              onClick={() => setTabSolicitacoes('rejeitadas')}
            >Rejeitadas</button>
          </div>

          {tabSolicitacoes === 'pendentes' && (
            <>
              {solicitacoes.length === 0 && <p>Nenhuma solicitação pendente.</p>}
              <div className="reservas-grid">
                {solicitacoes.map((s) => {
                  const sala = salas.find(sl => sl.id === s.sala_id);
                  return (
                    <div className="reserva-card admin-card" key={s.id}>
                      <h3>{s.sala_nome} · {s.titulo}</h3>
                      <p><strong>Solicitante:</strong> {s.responsavel}</p>
                      <p><strong>E-mail:</strong> {s.email}</p>
                      <p><strong>Data:</strong> {formatarData(s.data)}</p>
                      <p><strong>Horário:</strong> {s.hora_inicio} – {s.hora_fim}</p>
                      {sala && <p><strong>Localização:</strong> Bloco {sala.bloco || '?'} | {sala.andar || '?'}</p>}
                      {s.descricao && <p><strong>Descrição:</strong> {s.descricao}</p>}
                      <div className="reserva-actions">
                        <button className="edit-btn" onClick={() => handleAprovarSolicitacao(s.id)}>Aprovar</button>
                        <button className="cancel-btn" onClick={() => handleRejeitarSolicitacao(s.id)}>Rejeitar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tabSolicitacoes === 'rejeitadas' && (
            <>
              {rejeitadas.length === 0 && <p>Nenhuma reserva rejeitada.</p>}
              <div className="reservas-grid">
                {rejeitadas.map((s) => {
                  const sala = salas.find(sl => sl.id === s.sala_id);
                  return (
                    <div className="reserva-card admin-card" key={s.id}>
                      <h3>{s.sala_nome} · {s.titulo}</h3>
                      <p><strong>Solicitante:</strong> {s.responsavel}</p>
                      <p><strong>E-mail:</strong> {s.email}</p>
                      <p><strong>Data:</strong> {formatarData(s.data)}</p>
                      <p><strong>Horário:</strong> {s.hora_inicio} – {s.hora_fim}</p>
                      {sala && <p><strong>Localização:</strong> Bloco {sala.bloco || '?'} | {sala.andar || '?'}</p>}
                      {s.descricao && <p><strong>Descrição:</strong> {s.descricao}</p>}
                      <p><strong>Rejeitado por:</strong> {s.aprovador} em {new Date(s.data_aprovacao).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      );
    }

    // MEUS DADOS
    if (activeView === 'meus-dados') {
      return (
        <section className="box user-card-box">
          <div className="user-card">
            <h2>Meus Dados</h2>
            <p><strong>Nome:</strong> {currentUser.nome}</p>
            <p><strong>E-mail:</strong> {currentUser.email}</p>
            <p><strong>Cargo:</strong> {currentUser.cargo}</p>
          </div>
        </section>
      );
    }

    return <div>Selecione uma opção no menu.</div>;
  };

  return (
    <div className="app-layout">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Modal de edição de reserva */}
      {editandoReserva && (
        <div className="modal-overlay" onClick={() => setEditandoReserva(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Reserva</h3>
            <label>Título: <input type="text" value={editForm.titulo} onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })} /></label>
            <label>Data: <input type="date" value={editForm.data} onChange={(e) => setEditForm({ ...editForm, data: e.target.value })} /></label>
            <label>Início: <select value={editForm.hora_inicio} onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })}>
              {todosInicios.map((h) => <option key={h}>{h}</option>)}
            </select></label>
            <label>Fim: <select value={editForm.hora_fim} onChange={(e) => setEditForm({ ...editForm, hora_fim: e.target.value })}>
              {todosFins.filter((f) => timeToMinutes(f) > timeToMinutes(editForm.hora_inicio)).map((h) => <option key={h}>{h}</option>)}
            </select></label>
            <label>Descrição: <textarea value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} rows="2" /></label>
            <div className="modal-buttons">
              <button onClick={handleUpdateReserva}>Salvar</button>
              <button onClick={() => setEditandoReserva(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de solicitação de reserva */}
      <ReservaModal
        isOpen={modalReservaAberto}
        onClose={() => setModalReservaAberto(false)}
        salas={salas}
        currentUser={currentUser}
        userRole={currentUser.cargo === 'usuario_externo' ? 'externo' : 'interno'}
        initialData={reservaData}
      />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/CBiot_logo.jpg" alt="CBiot" className="logo-sidebar" />
          <div><strong>CBiot</strong><span>Reserva de salas</span></div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-section-title">PRINCIPAL</div>
          <button className={`sidebar-item ${activeView === 'inicio' ? 'active' : ''}`} onClick={() => setActiveView('inicio')}>Início</button>
          <button className={`sidebar-item ${activeView === 'consultar-disponibilidade' ? 'active' : ''}`} onClick={() => setActiveView('consultar-disponibilidade')}>Consultar disponibilidade</button>
          <button className={`sidebar-item ${activeView === 'minhas-reservas' ? 'active' : ''}`} onClick={() => setActiveView('minhas-reservas')}>Minhas reservas</button>
        </div>

        {(currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente') && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">ADMINISTRATIVO</div>
            <button className={`sidebar-item ${activeView === 'solicitacoes-reserva' ? 'active' : ''}`} onClick={() => setActiveView('solicitacoes-reserva')}>
              Solicitações de Reserva
            </button>
            <button className={`sidebar-item ${activeView === 'admin-reservas' ? 'active' : ''}`} onClick={() => setActiveView('admin-reservas')}>
              Gerenciar Reservas
            </button>
            {currentUser?.cargo === 'admin' && (
              <button className={`sidebar-item ${activeView === 'gerenciar-salas' ? 'active' : ''}`} onClick={() => setActiveView('gerenciar-salas')}>
                Gerenciar Salas
              </button>
            )}
            {currentUser?.cargo === 'admin' && (
              <button className={`sidebar-item ${activeView === 'gerenciar-usuarios' ? 'active' : ''}`} onClick={() => setActiveView('gerenciar-usuarios')}>
                Gerenciar Usuários
              </button>
            )}
          </div>
        )}

        <div className="sidebar-section">
          <div className="sidebar-section-title">CONTA</div>
          <button className={`sidebar-item ${activeView === 'meus-dados' ? 'active' : ''}`} onClick={() => setActiveView('meus-dados')}>Meus Dados</button>
          <button className="sidebar-item" onClick={handleLogout}>Sair</button>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-avatar">{currentUser?.nome?.charAt(0) || 'U'}</div>
          <div><div style={{ fontWeight: 600 }}>{currentUser?.nome}</div><div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{currentUser?.cargo}</div></div>
        </div>
      </aside>

      <main className="main-content">
        {renderMainContent()}
      </main>
    </div>
  );
}

export default App;