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

  // Estado para controle da aba na view de solicitações
  const [tabSolicitacoes, setTabSolicitacoes] = useState('pendentes');

  // Estados para consulta de disponibilidade
  const [modoDisponibilidade, setModoDisponibilidade] = useState('sala');
  const [disponibilidadeDataHora, setDisponibilidadeDataHora] = useState(null);
  const [dataConsulta, setDataConsulta] = useState('');
  const [horaConsulta, setHoraConsulta] = useState('08:00');
  const [horaFimConsulta, setHoraFimConsulta] = useState('08:30');

  // Estados para edição de reserva
  const [editandoReserva, setEditandoReserva] = useState(null);
  const [editForm, setEditForm] = useState({
    titulo: '',
    descricao: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
  });

  // Estados para gerenciamento de salas (admin)
  const [novaSala, setNovaSala] = useState({
    nome: '',
    bloco: '',
    andar: '',
    capacidade: '',
    equipamentos: '',
  });
  const [editandoSala, setEditandoSala] = useState(null);

  // Estado para controlar a view ativa do sidebar
  const [activeView, setActiveView] = useState('inicio');

  // Estado para cargos selecionados na aprovação de usuários
  const [selectedCargo, setSelectedCargo] = useState({});

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

  // ========== AUXILIARES ==========
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

  // ========== MANIPULAÇÃO DE RESERVAS ==========
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'responsavel' || name === 'email') return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

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

  // Cancelar reserva individual
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

  // Cancelar série recorrente (usuário comum ou admin/gerente)
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

  // Editar reserva (admin/gerente)
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
          if (activeView === 'minhas-reservas') await loadReservas();
          else if (activeView === 'admin-reservas') await loadAllReservas();
          return;
        } else {
          showToast(`${response.reservas_criadas.length} reservas criadas.`, 'success');
        }
      } else {
        showToast(response.mensagem, 'success');
      }
      await loadReservas();
      if (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente') await loadAllReservas();
      setForm((prev) => ({ ...prev, titulo: '', descricao: '' }));
      setDataFim('');
      setDiasSelecionados([]);
      setRecorrente(false);
    } else {
      if (response.mensagem && response.mensagem.includes('Solicitação enviada')) {
        showToast('Solicitação enviada. Aguarde aprovação.', 'info');
      } else {
        showToast('Reserva criada com sucesso!', 'success');
      }
      setForm((prev) => ({ ...prev, titulo: '', descricao: '' }));
      await loadReservas();
      if (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente') await loadAllReservas();
    }
  };

  // ========== DISPONIBILIDADE (para view separada) ==========
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

  // ========== GERENCIAMENTO DE USUÁRIOS (admin) ==========
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

  // ========== SOLICITAÇÕES DE RESERVA (admin/gerente) ==========
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

  // ========== ORDENAÇÃO DAS SALAS ==========
  const salasOrdenadas = useMemo(() => {
    return [...salas].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));
  }, [salas]);

  const selectsDisabled = !dataSelecionada && !recorrente;
  const camposTextDisabled = !dataSelecionada && !recorrente;

  if (!currentUser) return <div>Carregando...</div>;

  // ========== RENDERIZAÇÃO DAS VIEWS ==========
  const renderMainContent = () => {
    // VIEW INÍCIO
    if (activeView === 'inicio') {
      return (
        <>
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
                    horasInicioDisponiveis.map((h) => <option key={h}>{h}</option>)
                  ) : (
                    <option value="" disabled>Nenhum horário disponível</option>
                  )}
                </select>
              </label>
              <label>
                Fim *
                <select name="hora_fim" value={form.hora_fim} onChange={handleChange} required disabled={selectsDisabled}>
                  {horasFimDisponiveis.length > 0 ? (
                    horasFimDisponiveis.map((h) => <option key={h}>{h}</option>)
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
                <input type="text" name="responsavel" value={form.responsavel} required disabled />
              </label>
              <label>
                E-mail *
                <input type="email" name="email" value={form.email} required disabled />
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
                <button type="submit" disabled={(!dataSelecionada && !recorrente) || (dataSelecionada && horasInicioDisponiveis.length === 0)}>
                  Reservar
                </button>
              </div>
            </form>
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

    // GERENCIAR RESERVAS (admin/gerente) – todas as reservas aprovadas
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
        <section className="box">
          <h2>🔍 Consultar disponibilidade</h2>
          <div className="modo-consulta">
            <label><input type="radio" value="sala" checked={modoDisponibilidade === 'sala'} onChange={() => setModoDisponibilidade('sala')} /> Por sala e data</label>
            <label><input type="radio" value="data_hora" checked={modoDisponibilidade === 'data_hora'} onChange={() => setModoDisponibilidade('data_hora')} /> Por data e hora (intervalo)</label>
          </div>
          {modoDisponibilidade === 'sala' ? (
            <div className="consulta-sala">
              <label>Sala: <select value={form.sala_id} onChange={(e) => setForm((prev) => ({ ...prev, sala_id: e.target.value }))}>
                <option value="">Selecione</option>{salas.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select></label>
              <label>Data: <input type="date" value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} /></label>
              <button onClick={handleDisponibilidade}>Ver disponibilidade</button>
            </div>
          ) : (
            <div className="consulta-data-hora">
              <label>Data: <input type="date" value={dataConsulta} onChange={(e) => setDataConsulta(e.target.value)} /></label>
              <label>Início: <select value={horaConsulta} onChange={(e) => setHoraConsulta(e.target.value)}>{todosInicios.map((h) => <option key={h}>{h}</option>)}</select></label>
              <label>Fim: <select value={horaFimConsulta} onChange={(e) => setHoraFimConsulta(e.target.value)}>
                {todosFins.filter((f) => timeToMinutes(f) > timeToMinutes(horaConsulta)).map((h) => <option key={h}>{h}</option>)}
              </select></label>
              <button onClick={handleConsultarDisponibilidadeDataHora}>Buscar salas disponíveis</button>
            </div>
          )}
          {modoDisponibilidade === 'sala' && disponibilidade && (
            <div className="resultado-disponibilidade">
              <h3>Horários disponíveis - {disponibilidade.sala_nome} ({formatarData(disponibilidade.data)})</h3>
              <ul className="grid-list">
                {disponibilidade.horarios.map((item) => (
                  <li key={`${item.hora_inicio}-${item.hora_fim}`} className={item.ocupado ? (item.titulo?.startsWith('Manutenção') ? 'manutencao' : 'ocupado') : 'livre'}
                    onClick={() => {
                      if (!item.ocupado) {
                        setForm((prev) => ({ ...prev, sala_id: form.sala_id, data: form.data, hora_inicio: item.hora_inicio, hora_fim: item.hora_fim }));
                        setActiveView('inicio');
                        document.getElementById('form-reserva')?.scrollIntoView({ behavior: 'smooth' });
                        showToast(`Horário ${item.hora_inicio} - ${item.hora_fim} selecionado`, 'info');
                      }
                    }} style={item.ocupado ? {} : { cursor: 'pointer' }}>
                    <strong>{item.hora_inicio}</strong> - {item.hora_fim} <strong>{item.ocupado ? item.titulo : ' Livre'}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {modoDisponibilidade === 'data_hora' && disponibilidadeDataHora && (
            <div className="resultado-disponibilidade">
              <h3>Salas disponíveis em {formatarData(dataConsulta)} das {horaConsulta} às {horaFimConsulta}</h3>
              {disponibilidadeDataHora.length === 0 ? <p>Nenhuma sala disponível nesse horário.</p> : (
                <div className="salas-disponiveis-grid">
                  {disponibilidadeDataHora.map((sala) => (
                    <div key={sala.id} className="sala-card-mapa" onClick={() => {
                      setForm({ sala_id: sala.id, titulo: form.titulo, data: dataConsulta, hora_inicio: horaConsulta, hora_fim: horaFimConsulta, responsavel: form.responsavel, email: form.email, descricao: form.descricao });
                      setActiveView('inicio');
                      document.getElementById('form-reserva')?.scrollIntoView({ behavior: 'smooth' });
                      showToast('Formulário preenchido com a sala e horário selecionados', 'info');
                    }}>
                      <div className="sala-nome">{sala.nome}</div>
                      <div className="sala-localizacao">📍 Bloco {sala.bloco || '?'} | {sala.andar || '?'}</div>
                      <div className="sala-info">👥 Capacidade: {sala.capacidade || '?'}</div>
                      {sala.equipamentos && <div className="sala-equipamentos">📋 {sala.equipamentos.substring(0, 50)}...</div>}
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

    // SOLICITAÇÕES DE RESERVA (admin/gerente) com abas Pendentes / Rejeitadas
    // O estado tabSolicitacoes foi definido no topo do componente
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

      {/* Conteúdo principal */}
      <main className="main-content">
        <div className="page-header">
          <div><h1>Reservas</h1><p>Bem-vindo de volta, {currentUser?.nome}!</p></div>
          <div className="page-header-actions"><span>{currentUser?.email}</span></div>
        </div>
        {renderMainContent()}
      </main>
    </div>
  );
}

export default App;