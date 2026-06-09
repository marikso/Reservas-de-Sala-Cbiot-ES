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
  getMinhasSolicitacoes,
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
  const [tabReservas, setTabReservas] = useState('ativas');

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
  const [formSalaAberto, setFormSalaAberto] = useState(false);
  const [formManutAberto, setFormManutAberto] = useState(false);
  const [alterandoPapelUser, setAlterandoPapelUser] = useState(null);
  const [novoPapelSelecionado, setNovoPapelSelecionado] = useState('');

  // Estados para seleção de intervalo na consulta de disponibilidade
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);

  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([]);
  const loadMinhasSolicitacoes = async () => {
    const data = await getMinhasSolicitacoes();
    setSolicitacoesPendentes(data);
  };

  const [reservaData, setReservaData] = useState({
    sala_id: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
    titulo: '',
  });
  const [modalReservaAberto, setModalReservaAberto] = useState(false);
  const dataSelecionada = !!form.data;

  // Estados para filtros de reservas (admin)
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroSala, setFiltroSala] = useState('todas');
  const [filtroPeriodo, setFiltroPeriodo] = useState('proximas');

  // ========== ESTADOS PARA MANUTENÇÃO ==========
  const [manutencoes, setManutencoes] = useState([]);
  const [novaManutencao, setNovaManutencao] = useState({
    sala_id: '',
    data_inicio: '',
    data_fim: '',
    hora_inicio: '08:00',
    hora_fim: '09:00',
    motivo: '',
  });
  const horariosManutencao = useMemo(() => generateAllStartTimes(), []);

  // ========== ESTADOS PARA RELATÓRIOS ==========
  const [periodoRelatorio, setPeriodoRelatorio] = useState('30d');
  const [dataInicioCustom, setDataInicioCustom] = useState('');
  const [dataFimCustom, setDataFimCustom] = useState('');
  const [periodoCustomAplicado, setPeriodoCustomAplicado] = useState(false);
  const [metricas, setMetricas] = useState({ totalReservas: 0, totalHoras: 0, mediaDiaria: 0, usuariosDistintos: 0 });
  const [rankingSalas, setRankingSalas] = useState([]);

  // ========== CARREGAMENTO INICIAL ==========
  const loadSalas = async () => {
    const data = await getSalas();
    // Marcar em_manutencao baseado em bloqueios ativos
    const hoje = new Date().toISOString().slice(0, 10);
    const manutAtivas = manutencoes.filter(m => m.data_inicio <= hoje && m.data_fim >= hoje);
    const salasComManut = new Set(manutAtivas.map(m => m.sala_id));
    const salasAtualizadas = data.map(s => ({ ...s, em_manutencao: salasComManut.has(s.id) }));
    setSalas(salasAtualizadas.sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true })));
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
  const loadManutencoes = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/manutencoes', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setManutencoes(data);
      }
    } catch (err) {
      console.error('Erro ao carregar manutenções', err);
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
        loadManutencoes();
      }
      if (currentUser.cargo === 'usuario_externo') {
        loadMinhasSolicitacoes();
      }
      if (currentUser.cargo === 'admin') {
        loadUsers();
      }
    }
  }, [currentUser]);

  // Atualiza em_manutencao nas salas quando manutencoes mudar
  useEffect(() => {
    if (salas.length && manutencoes.length) {
      const hoje = new Date().toISOString().slice(0, 10);
      const manutAtivas = manutencoes.filter(m => m.data_inicio <= hoje && m.data_fim >= hoje);
      const salasComManut = new Set(manutAtivas.map(m => m.sala_id));
      setSalas(prev => prev.map(s => ({ ...s, em_manutencao: salasComManut.has(s.id) })));
    }
  }, [manutencoes]);

  // ========== FUNÇÕES DE FORMATAÇÃO (UTC → BRASÍLIA) ==========
  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };
  const formatarDataHoraBrasilia = (isoString) => {
    if (!isoString) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(isoString));
  };
  const formatarDataBrasilia = (isoString) => {
    if (!isoString) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
    }).format(new Date(isoString));
  };

  // ========== LÓGICA DE HORÁRIOS DISPONÍVEIS ==========
  const reservasIntervalos = useMemo(
    () =>
      reservasDoDia.map((r) => ({
        inicio: timeToMinutes(r.hora_inicio),
        fim: timeToMinutes(r.hora_fim),
      })),
    [reservasDoDia]
  );
  const conflita = (inicio, fim) => reservasIntervalos.some((r) => inicio < r.fim && fim > r.inicio);
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
    if (recorrente) return todosFins.filter((fimStr) => timeToMinutes(fimStr) > inicioMin);
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

  // ========== DISPONIBILIDADE ==========
  const handleDisponibilidade = async () => {
    if (!form.sala_id || !form.data) {
      showToast('Escolha sala e data para ver disponibilidade', 'error');
      return;
    }
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

  // ========== ADMIN (GERENCIAR SALAS, USUÁRIOS, ETC) ==========
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

  // Manutenções
  const handleChangeManutencao = (e) => {
    const { name, value } = e.target;
    setNovaManutencao((prev) => ({ ...prev, [name]: value }));
  };
  const handleCriarManutencao = async () => {
    if (!novaManutencao.sala_id || !novaManutencao.data_inicio || !novaManutencao.data_fim || !novaManutencao.motivo) {
      showToast('Preencha todos os campos da manutenção', 'error');
      return;
    }
    // Validação de data: início não pode ser maior que fim
    if (novaManutencao.data_inicio > novaManutencao.data_fim) {
      showToast('A data de início deve ser anterior ou igual à data de fim', 'error');
      return;
    }
    // Validação opcional: permitir qualquer horário (sem comparar inicio vs fim)
    try {
      const res = await fetch('http://localhost:5000/api/manutencoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(novaManutencao),
      });
      const data = await res.json();
      if (!res.ok) showToast(data.erro || 'Erro ao criar bloqueio', 'error');
      else {
        showToast('Bloqueio criado com sucesso', 'success');
        setNovaManutencao({
          sala_id: '',
          data_inicio: '',
          data_fim: '',
          hora_inicio: '08:00',
          hora_fim: '09:00',
          motivo: '',
        });
        await loadManutencoes();
        await loadSalas();
      }
    } catch (err) {
      showToast('Erro de conexão', 'error');
    }
  };
  const handleRemoverManutencao = async (id) => {
    if (window.confirm('Remover este bloqueio de manutenção?')) {
      try {
        const res = await fetch(`http://localhost:5000/api/manutencoes/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
          showToast('Bloqueio removido', 'success');
          await loadManutencoes();
          await loadSalas();
        } else {
          const err = await res.json();
          showToast(err.erro || 'Erro ao remover', 'error');
        }
      } catch (err) {
        showToast('Erro de conexão', 'error');
      }
    }
  };
  const handleLiberarSala = async (salaId) => {
    const ativos = manutencoes.filter(m => m.sala_id === salaId);
    for (const m of ativos) {
      try {
        await fetch(`http://localhost:5000/api/manutencoes/${m.id}`, { method: 'DELETE', credentials: 'include' });
      } catch {}
    }
    await loadManutencoes();
    await loadSalas();
    showToast('Sala liberada para uso', 'success');
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

  // ========== FUNÇÕES DOS RELATÓRIOS ==========
  const getReservasPorPeriodo = () => {
    if (periodoRelatorio === 'custom' && periodoCustomAplicado && dataInicioCustom && dataFimCustom) {
      const inicio = new Date(dataInicioCustom);
      const fim = new Date(dataFimCustom);
      fim.setHours(23, 59, 59);
      return allReservas.filter(r => {
        const dataReserva = new Date(r.data);
        return dataReserva >= inicio && dataReserva <= fim;
      });
    }
    const agora = new Date();
    let dataLimite = null;
    if (periodoRelatorio === '30d') {
      dataLimite = new Date(agora);
      dataLimite.setDate(agora.getDate() - 30);
    } else if (periodoRelatorio === '90d') {
      dataLimite = new Date(agora);
      dataLimite.setDate(agora.getDate() - 90);
    } else if (periodoRelatorio === 'ano') {
      dataLimite = new Date(agora.getFullYear(), 0, 1);
    }
    if (dataLimite) {
      return allReservas.filter(r => new Date(r.data) >= dataLimite);
    }
    return allReservas;
  };

  const atualizarRelatorios = () => {
    const reservasPeriodo = getReservasPorPeriodo();
    const reservasAprovadas = reservasPeriodo.filter(r => r.status === 'aprovada');
    const totalReservas = reservasPeriodo.length;
    const totalHoras = reservasAprovadas.reduce((acc, r) => {
      const inicio = parseInt(r.hora_inicio.split(':')[0]) + parseInt(r.hora_inicio.split(':')[1]) / 60;
      const fim = parseInt(r.hora_fim.split(':')[0]) + parseInt(r.hora_fim.split(':')[1]) / 60;
      return acc + (fim - inicio);
    }, 0);
    const mediaDiaria = reservasAprovadas.length / 30;
    const usuariosDistintos = new Set(reservasPeriodo.map(r => r.email)).size;
    setMetricas({ totalReservas, totalHoras: totalHoras.toFixed(1), mediaDiaria: mediaDiaria.toFixed(1), usuariosDistintos });

    const salasCount = {};
    reservasAprovadas.forEach(r => { salasCount[r.sala_nome] = (salasCount[r.sala_nome] || 0) + 1; });
    const ranking = Object.entries(salasCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, qtd]) => ({ nome, qtd }));
    setRankingSalas(ranking);
  };

  useEffect(() => {
    if (activeView === 'relatorios') atualizarRelatorios();
  }, [periodoRelatorio, periodoCustomAplicado, dataInicioCustom, dataFimCustom, allReservas, activeView]);

  const exportarRelatorioCSV = () => {
    const reservasPeriodo = getReservasPorPeriodo();
    const headers = ['Usuário', 'E-mail', 'Sala', 'Data', 'Horário', 'Status', 'Título'];
    const rows = reservasPeriodo.map(r => [
      r.responsavel, r.email, r.sala_nome,
      formatarData(r.data), `${r.hora_inicio} - ${r.hora_fim}`,
      r.status === 'aprovada' ? 'Confirmada' : (r.status === 'pendente' ? 'Pendente' : (r.status === 'rejeitada' ? 'Rejeitada' : 'Cancelada')),
      r.titulo
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_reservas_${periodoRelatorio === 'custom' ? 'custom' : periodoRelatorio}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const aplicarPeriodoCustom = () => {
    if (dataInicioCustom && dataFimCustom) {
      setPeriodoCustomAplicado(true);
      setPeriodoRelatorio('custom');
    } else {
      alert('Selecione data de início e fim');
    }
  };

  if (!currentUser) return <div>Carregando...</div>;

  // ========== RENDERIZAÇÃO DAS VIEWS ==========
  const renderMainContent = () => {
    // VIEW INÍCIO
    if (activeView === 'inicio') {
  const salaSelecionada = !!form.sala_id;

  return (
    <section
      className="box mapa-salas-prototipo"
      onClick={() => setForm((prev) => ({ ...prev, sala_id: '' }))}
    >
      <div className="gs-header">
        <div>
          <h2 className="gs-titulo">Mapa das Salas</h2>
          <p className="gs-subtitulo">Clique em uma sala para iniciar uma solicitação de reserva.</p>
        </div>
        <button
          className={`btn-solicitar-reserva-inicio ${salaSelecionada ? 'ativo' : 'inativo'}`}
          disabled={!salaSelecionada}
          onClick={(e) => { e.stopPropagation(); setModalReservaAberto(true); }}
        >
          + Solicitar Reserva
        </button>
      </div>

      <div className="salas-grid-mapa">
        {salasOrdenadas.map((sala) => {
          const isSelecionada = form.sala_id == sala.id;

          return (
            <div
              key={sala.id}
              className={`sala-card-mapa ${isSelecionada ? 'selecionada' : ''} ${sala.em_manutencao ? 'manutencao' : ''}`}
              onClick={(e) => { e.stopPropagation(); setForm((prev) => ({ ...prev, sala_id: sala.id })); }}
            >
              {isSelecionada && <div className="badge-selecionada">SELECIONADA</div>}

              <div className="sala-nome-destaque">{sala.nome}</div>
              <div className="sala-localizacao-texto">
                Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}
              </div>
              <div className="sala-localizacao-texto">
                Capacidade: {sala.capacidade || '?'} pessoas
              </div>

              {sala.equipamentos && (
                <div className="sala-equipamentos-lista">
                  <div className="equipamentos-titulo">EQUIPAMENTOS</div>
                  <ul>
                    {sala.equipamentos.split(',').map((item, idx) => (
                      <li key={idx}>
                        <span className="quadrado-roxo"></span>
                        {item.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sala.em_manutencao && <div className="badge-manutencao">🔧 Em manutenção</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

    // MINHAS RESERVAS (com abas e horário Brasília)
    if (activeView === 'minhas-reservas') {
      const agora = new Date();
      const hojeLocal = agora.toLocaleDateString('en-CA');
      const horaAtual = agora.getHours() * 60 + agora.getMinutes();
      const isExterno = currentUser.cargo === 'usuario_externo';

      const reservasAtivas = reservas.filter(r => {
        if (r.status !== 'aprovada') return false;
        if (r.data > hojeLocal) return true;
        if (r.data === hojeLocal) {
          const [hFim, mFim] = r.hora_fim.split(':').map(Number);
          return (hFim * 60 + mFim) > horaAtual;
        }
        return false;
      });

      const reservasPendentes = solicitacoesPendentes;

      const reservasHistorico = reservas.filter(r => {
        if (r.status === 'rejeitada' || r.status === 'cancelada' || r.status === 'expirada') return true;
        if (r.status !== 'aprovada') return false;
        if (r.data < hojeLocal) return true;
        if (r.data === hojeLocal) {
          const [hFim, mFim] = r.hora_fim.split(':').map(Number);
          return (hFim * 60 + mFim) <= horaAtual;
        }
        return false;
      });

      const renderReservaCard = (reserva, isHistorico = false) => {
        const sala = salas.find((s) => s.id === reserva.sala_id);
        const [ano, mes, dia] = reserva.data.split('-');
        const dataObj = new Date(Date.UTC(ano, mes - 1, dia));
        const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
        const diaSemana = diasSemana[dataObj.getUTCDay()];
        const dataFormatada = `${dia}/${mes}/${ano}`;
        let statusClass = '', statusTexto = '';
        if (reserva.status === 'aprovada') { statusClass = 'status-confirmada'; statusTexto = 'CONFIRMADA'; }
        else if (reserva.status === 'pendente') { statusClass = 'status-pendente'; statusTexto = 'PENDENTE'; }
        else { statusClass = 'status-cancelada'; statusTexto = reserva.status === 'rejeitada' ? 'REJEITADA' : 'CANCELADA'; }

        return (
          <div className="reserva-card-minha" key={reserva.id}>
            <div className="reserva-card-header">
              <h3>{reserva.sala_nome}</h3>
              <span className={`reserva-status ${statusClass}`}>{statusTexto}</span>
            </div>
            <div className="reserva-card-info">
              <p><strong>{dataFormatada}</strong> · {diaSemana} · {reserva.hora_inicio} às {reserva.hora_fim}</p>
              {sala && <p className="sala-localizacao-card">Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}</p>}
              <p className="reserva-titulo">{reserva.titulo}</p>
              {reserva.status === 'pendente' && !isHistorico && <p className="reserva-pendente-msg">Solicitada em {formatarDataBrasilia(reserva.data_criacao || reserva.data)} · aguardando análise do gerente</p>}
              {reserva.status === 'aprovada' && reserva.aprovador && <p className="reserva-aprovada-msg">Aprovada em {formatarDataBrasilia(reserva.data_aprovacao)} por {reserva.aprovador} · Chave com Silvia</p>}
            </div>
            {!isHistorico && (
              <div className="reserva-actions-minhas">
                {(currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente' || reserva.email === currentUser?.email) &&
                  <button className="edit-reserva-btn" onClick={() => handleEditarReserva(reserva)}>Editar solicitação</button>}
                {reserva.grupo_id && <button className="cancel-group-btn" onClick={() => handleCancelarGrupo(reserva.grupo_id, true)}>Cancelar série</button>}
                <button className="cancel-reserva-btn" onClick={() => handleCancelarReserva(reserva.id, reserva.titulo)}>Cancelar solicitação</button>
              </div>
            )}
            {isHistorico && (
              <div className="reserva-actions-minhas">
                <button className="detalhes-reserva-btn" onClick={() => alert(`Detalhes da reserva:\nTítulo: ${reserva.titulo}\nSala: ${reserva.sala_nome}\nData: ${dataFormatada}\nHorário: ${reserva.hora_inicio} - ${reserva.hora_fim}`)}>Ver detalhes</button>
              </div>
            )}
          </div>
        );
      };

      return (
        <div className="gs-container">
          <div className="gs-header">
            <div>
              <h2 className="gs-titulo">Minhas reservas</h2>
              <p className="gs-subtitulo">Acompanhe o status das suas solicitações de reserva.</p>
            </div>
          </div>
          <div className="modo-consulta" style={{ marginBottom: '1.5rem' }}>
            <label className={`modo-radio ${tabReservas === 'ativas' ? 'active' : ''}`}>
              <input type="radio" name="tabReservas" value="ativas" checked={tabReservas === 'ativas'} onChange={() => setTabReservas('ativas')} />
              <span>Ativas ({reservasAtivas.length})</span>
            </label>
            {isExterno && (
              <label className={`modo-radio ${tabReservas === 'pendentes' ? 'active' : ''}`}>
                <input type="radio" name="tabReservas" value="pendentes" checked={tabReservas === 'pendentes'} onChange={() => setTabReservas('pendentes')} />
                <span>Pendentes ({reservasPendentes.length})</span>
              </label>
            )}
            <label className={`modo-radio ${tabReservas === 'historico' ? 'active' : ''}`}>
              <input type="radio" name="tabReservas" value="historico" checked={tabReservas === 'historico'} onChange={() => setTabReservas('historico')} />
              <span>Histórico ({reservasHistorico.length})</span>
            </label>
          </div>
          <div className="reservas-lista">
            {tabReservas === 'ativas' && (reservasAtivas.length === 0 ? <p className="sem-reservas">Nenhuma reserva ativa.</p> : reservasAtivas.map(r => renderReservaCard(r, false)))}
            {tabReservas === 'pendentes' && isExterno && (reservasPendentes.length === 0 ? <p className="sem-reservas">Nenhuma solicitação pendente.</p> : reservasPendentes.map(r => renderReservaCard(r, false)))}
            {tabReservas === 'historico' && (reservasHistorico.length === 0 ? <p className="sem-reservas">Nenhuma solicitação no histórico.</p> : reservasHistorico.map(r => renderReservaCard(r, true)))}
          </div>
        </div>
      );
    }

    // GERENCIAR RESERVAS (ADMIN/GERENTE) – com filtros
    if (activeView === 'admin-reservas' && (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente')) {
      const statusOptions = [
        { value: 'todas', label: 'Todas' },
        { value: 'aprovada', label: 'Confirmadas' },
        { value: 'pendente', label: 'Pendentes' },
        { value: 'rejeitada', label: 'Rejeitadas' },
        { value: 'cancelada', label: 'Canceladas' },
      ];
      const periodoOptions = [
        { value: 'proximas', label: 'Próximas reservas' },
        { value: 'passadas', label: 'Reservas passadas' },
        { value: 'todas', label: 'Todas' },
      ];

      const hojeLocal = new Date().toLocaleDateString('en-CA');
      const agora = new Date();
      const horaAtual = agora.getHours() * 60 + agora.getMinutes();

      const reservasFiltradas = allReservas.filter(r => {
        if (filtroTexto.trim() !== '') {
          const termo = filtroTexto.toLowerCase();
          const matchUsuario = r.responsavel?.toLowerCase().includes(termo) || r.email?.toLowerCase().includes(termo);
          const matchSala = r.sala_nome?.toLowerCase().includes(termo);
          if (!matchUsuario && !matchSala) return false;
        }
        if (filtroStatus !== 'todas' && r.status !== filtroStatus) return false;
        if (filtroSala !== 'todas' && r.sala_id !== parseInt(filtroSala)) return false;
        if (filtroPeriodo === 'proximas') {
          if (r.data > hojeLocal) return true;
          if (r.data === hojeLocal) {
            const [hFim, mFim] = r.hora_fim.split(':').map(Number);
            return (hFim * 60 + mFim) > horaAtual;
          }
          return false;
        } else if (filtroPeriodo === 'passadas') {
          if (r.data < hojeLocal) return true;
          if (r.data === hojeLocal) {
            const [hFim, mFim] = r.hora_fim.split(':').map(Number);
            return (hFim * 60 + mFim) <= horaAtual;
          }
          return false;
        }
        return true;
      });

      const recorrentesNoFiltro = reservasFiltradas.filter(r => r.grupo_id).length;

      const exportarCSV = () => {
        const headers = ['Usuário', 'E-mail', 'Sala', 'Data', 'Horário', 'Status', 'Título', 'Descrição', 'Grupo ID'];
        const rows = reservasFiltradas.map(r => [
          r.responsavel,
          r.email,
          r.sala_nome,
          formatarData(r.data),
          `${r.hora_inicio} - ${r.hora_fim}`,
          r.status === 'aprovada' ? 'Confirmada' : (r.status === 'pendente' ? 'Pendente' : (r.status === 'rejeitada' ? 'Rejeitada' : 'Cancelada')),
          r.titulo,
          r.descricao || '',
          r.grupo_id || '',
        ]);
        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'reservas.csv';
        link.click();
        URL.revokeObjectURL(link.href);
      };

      const salasOptions = [{ value: 'todas', label: 'Todas' }, ...salas.map(s => ({ value: s.id.toString(), label: s.nome }))];

      return (
        <div className="gs-container">
          <div className="gs-header">
            <div>
              <h2 className="gs-titulo">Gerenciar Reservas</h2>
              <p className="gs-subtitulo">Visualize e gerencie todas as reservas do sistema.</p>
            </div>
          </div>
          <div className="gs-filtros">
            <input className="gs-filtros-busca" type="text" placeholder="⌕ Buscar por usuário ou sala..." value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} />
            <select className="filtros-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select className="filtros-select" value={filtroSala} onChange={e => setFiltroSala(e.target.value)}>
              {salasOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select className="filtros-select" value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
              {periodoOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <button className="gs-btn-exportar" onClick={exportarCSV}>Exportar CSV</button>
          </div>
          <div className="gs-stats-bar">
            <span className="gs-stats-total">Mostrando {reservasFiltradas.length}</span>
            <span className="gs-stats-detail">de {allReservas.length} reservas{recorrentesNoFiltro > 0 ? ` · ${recorrentesNoFiltro} recorrente(s) no período` : ''}</span>
          </div>

          <div className="gu-table-header">
            <span style={{flex:'0 0 230px'}}>USUÁRIO</span>
            <span style={{flex:2}}>SALA</span>
            <span style={{flex:2}}>DATA / HORÁRIO</span>
            <span style={{flex:'0 0 130px'}}>STATUS</span>
            <span style={{flex:'0 0 170px'}}>AÇÕES</span>
          </div>
          <div className="gu-rows">
            {reservasFiltradas.length === 0 && <p className="admin-req-vazio">Nenhuma reserva encontrada.</p>}
            {reservasFiltradas.map(r => {
              const [ano, mes, dia] = r.data.split('-');
              const dataObj = new Date(Date.UTC(ano, mes-1, dia));
              const diaSemana = ['dom','seg','ter','qua','qui','sex','sáb'][dataObj.getUTCDay()];
              const dataFormatada = `${dia}/${mes}/${ano}`;
              const statusBg = r.status==='aprovada'?'#2ECC71':r.status==='pendente'?'#F39C12':r.status==='rejeitada'?'#E74C3C':'#95A5A6';
              const statusTxt = r.status==='aprovada'?'CONFIRMADA':r.status==='pendente'?'PENDENTE':r.status==='rejeitada'?'REJEITADA':'CANCELADA';
              return (
                <div key={r.id} className="gu-row">
                  <div style={{flex:'0 0 230px',display:'flex',alignItems:'center',gap:'10px'}}>
                    <div className="gu-avatar">{(r.responsavel||'??').substring(0,2).toUpperCase()}</div>
                    <div>
                      <div style={{fontWeight:700,color:'#1A0F2B',fontSize:'13px',lineHeight:1.3}}>{r.responsavel}</div>
                      <div style={{color:'#6B5F7A',fontSize:'11px'}}>{r.email}</div>
                    </div>
                  </div>
                  <div style={{flex:2}}>
                    <div style={{fontWeight:700,color:'#1A0F2B',fontSize:'13px'}}>{r.sala_nome}</div>
                    {r.titulo && <div style={{color:'#6B5F7A',fontSize:'11px'}}>{r.titulo}</div>}
                  </div>
                  <div style={{flex:2}}>
                    <div style={{fontWeight:700,color:'#1A0F2B',fontSize:'12px'}}>{dataFormatada} ({diaSemana})</div>
                    <div style={{color:'#6B5F7A',fontSize:'11px'}}>{r.hora_inicio} às {r.hora_fim}</div>
                  </div>
                  <div style={{flex:'0 0 130px',display:'flex',flexDirection:'column',gap:'4px',alignItems:'flex-start'}}>
                    {r.grupo_id && <span className="gu-status-badge" style={{background:'#3498DB'}}>RECORRENTE</span>}
                    <span className="gu-status-badge" style={{background:statusBg}}>{statusTxt}</span>
                  </div>
                  <div style={{flex:'0 0 170px',display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
                    <button className="gu-btn-papel" onClick={() => handleEditarReserva(r)}>Editar</button>
                    {r.grupo_id && <button className="gu-btn-sec" onClick={() => handleCancelarGrupo(r.grupo_id, false)}>Série</button>}
                    <button className="gu-btn-sec" onClick={() => handleCancelarReserva(r.id, r.titulo)}>Cancelar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // RELATÓRIOS (admin/gerente)
    if (activeView === 'relatorios' && (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente')) {
      return (
        <div className="gs-container">
          <div className="gs-header">
            <div>
              <h2 className="gs-titulo">Relatórios</h2>
              <p className="gs-subtitulo">Estatísticas de reservas por período — total, horas, média diária e usuários.</p>
            </div>
            <button className="gs-btn-novo" onClick={exportarRelatorioCSV}>Exportar CSV</button>
          </div>

          <div className="gs-filtros" style={{alignItems:'center'}}>
            <span style={{fontSize:'13px',fontWeight:700,color:'#4B3A6B'}}>Período:</span>
            <select className="filtros-select" value={periodoRelatorio} onChange={e => {
              setPeriodoRelatorio(e.target.value);
              if (e.target.value !== 'custom') setPeriodoCustomAplicado(false);
            }}>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="ano">Ano atual</option>
              <option value="todos">Todo histórico</option>
              <option value="custom">Personalizado...</option>
            </select>
            {periodoRelatorio === 'custom' && (
              <>
                <input className="modal-input" type="date" value={dataInicioCustom} onChange={e => setDataInicioCustom(e.target.value)} style={{width:'auto'}} />
                <span style={{color:'#6B5F7A'}}>a</span>
                <input className="modal-input" type="date" value={dataFimCustom} onChange={e => setDataFimCustom(e.target.value)} style={{width:'auto'}} />
                <button className="gs-btn-novo" onClick={aplicarPeriodoCustom}>Aplicar</button>
              </>
            )}
          </div>

          <div className="relatorio-metricas">
            <div className="metrica-card"><h3>Total reservas</h3><p>{metricas.totalReservas}</p><small>Todos os status no período.</small></div>
            <div className="metrica-card"><h3>Horas reservadas</h3><p>{metricas.totalHoras}</p><small>Reservas confirmadas.</small></div>
            <div className="metrica-card"><h3>Média diária</h3><p>{metricas.mediaDiaria}</p><small>Confirmadas por dia.</small></div>
            <div className="metrica-card"><h3>Usuários distintos</h3><p>{metricas.usuariosDistintos}</p><small>Usuários que reservaram.</small></div>
          </div>

          <div style={{marginTop:'24px'}}>
            <div className="gs-stats-bar" style={{marginBottom:'12px'}}>
              <span className="gs-stats-total">Salas mais reservadas</span>
              <span className="gs-stats-detail">top 5 por reservas confirmadas</span>
            </div>
            <table className="ranking-table">
              <thead><tr><th>Sala</th><th>Quantidade</th></tr></thead>
              <tbody>
                {rankingSalas.map((item, idx) => <tr key={idx}><td>{item.nome}</td><td style={{ textAlign: 'center' }}>{item.qtd}</td></tr>)}
                {rankingSalas.length === 0 && <tr><td colSpan="2">Nenhuma reserva no período</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // CONSULTAR DISPONIBILIDADE
    if (activeView === 'consultar-disponibilidade') {
      const salaSelecionadaObj = salas.find(s => Number(s.id) === Number(form.sala_id));
      const dateObj = form.data ? new Date(form.data + 'T12:00:00') : null;
      const diaNum = dateObj ? dateObj.getDate() : null;
      const mesAbrev = dateObj ? dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : null;
      const diaSemana = dateObj ? dateObj.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase() : null;
      return (
        <div className="gs-container">
          <div className="gs-header">
            <div>
              <h2 className="gs-titulo">Consultar disponibilidade</h2>
              <p className="gs-subtitulo">Clique em um horário disponível para solicitar reserva · blocos de 30 min.</p>
            </div>
          </div>

          <div className="cd-tabs">
            <button className={`cd-tab ${modoDisponibilidade === 'sala' ? 'cd-tab-ativo' : ''}`} onClick={() => setModoDisponibilidade('sala')}>Por sala</button>
            <button className={`cd-tab ${modoDisponibilidade === 'data_hora' ? 'cd-tab-ativo' : ''}`} onClick={() => setModoDisponibilidade('data_hora')}>Por data e hora</button>
          </div>

          {modoDisponibilidade === 'sala' && (
            <>
              <div className="cd-filtro-card">
                <div className="cd-filtro-field">
                  <label className="cd-filtro-label">SALA</label>
                  <select className="cd-filtro-select" value={form.sala_id} onChange={(e) => setForm((prev) => ({ ...prev, sala_id: e.target.value }))}>
                    <option value="">Selecione uma sala</option>
                    {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                <div className="cd-filtro-field">
                  <label className="cd-filtro-label">DATA</label>
                  <input className="cd-filtro-input" type="date" value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} />
                </div>
                <button className="cd-filtro-btn" onClick={handleDisponibilidade}>Ver horários</button>
              </div>

              {disponibilidade && (
                <div className="cd-resultado">
                  <div className="cd-sala-info">
                    <div className="cd-sala-info-texto">
                      <div className="cd-sala-nome">{salaSelecionadaObj?.nome || disponibilidade.sala_nome}</div>
                      <div className="cd-sala-detalhes">
                        {salaSelecionadaObj?.capacidade && `Capacidade: ${salaSelecionadaObj.capacidade} pessoas`}
                        {salaSelecionadaObj?.andar && ` · ${salaSelecionadaObj.andar}`}
                        {salaSelecionadaObj?.equipamentos && ` · ${salaSelecionadaObj.equipamentos}`}
                      </div>
                    </div>
                    {dateObj && (
                      <div className="cd-data-badge">
                        <span className="cd-data-dia">{diaNum} {mesAbrev}</span>
                        <span className="cd-data-semana">{diaSemana}</span>
                      </div>
                    )}
                  </div>
                  <div className="cd-info-banner">
                    <span className="cd-info-icon">i</span>
                    <span>Lembre-se: a chave da sala é retirada e devolvida na portaria. Controles remotos devem permanecer na sala.</span>
                  </div>
                  <p className="cd-grade-titulo">Horários · 08:00 às 19:00 · blocos de 30 min</p>
                  <div className="cd-grade-horarios">
                    {disponibilidade.horarios.map((item) => {
                      let statusClass = '', statusText = '', isSelected = false;
                      if (item.ocupado) {
                        statusClass = item.titulo?.startsWith('Manutenção') ? 'cd-slot-manut' : 'cd-slot-reservado';
                        statusText = item.titulo?.startsWith('Manutenção') ? 'MANUTENÇÃO' : 'RESERVADO';
                      } else {
                        statusClass = 'cd-slot-disponivel'; statusText = 'DISPONÍVEL';
                        if (selectedStart && selectedEnd && item.hora_inicio >= selectedStart.hora_inicio && item.hora_inicio <= selectedEnd.hora_inicio) isSelected = true;
                        else if (selectedStart && !selectedEnd && item.hora_inicio === selectedStart.hora_inicio) isSelected = true;
                      }
                      if (isSelected && !item.ocupado) { statusClass = 'cd-slot-selecionado'; statusText = 'SELECIONADO'; }
                      return (
                        <div key={`${item.hora_inicio}-${item.hora_fim}`} className={`cd-slot ${statusClass}`} onClick={() => {
                          if (item.ocupado) return;
                          if (!selectedStart) setSelectedStart(item);
                          else if (!selectedEnd) { if (item.hora_inicio > selectedStart.hora_inicio) setSelectedEnd(item); else setSelectedStart(item); }
                          else { setSelectedStart(item); setSelectedEnd(null); }
                        }}>
                          <span className="cd-slot-hora">{item.hora_inicio}</span>
                          <span className="cd-slot-status">{statusText}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="cd-legenda">
                    <div className="cd-legenda-item"><span className="cd-legenda-cor cd-leg-disponivel"></span>Disponível</div>
                    <div className="cd-legenda-item"><span className="cd-legenda-cor cd-leg-selecionado"></span>Selecionado</div>
                    <div className="cd-legenda-item"><span className="cd-legenda-cor cd-leg-reservado"></span>Reservado</div>
                    <div className="cd-legenda-item"><span className="cd-legenda-cor cd-leg-manut"></span>Indisponível</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <button className="solicitar-reserva-btn" onClick={() => {
                      if (selectedStart && selectedEnd) {
                        setReservaData({ sala_id: form.sala_id, data: form.data, hora_inicio: selectedStart.hora_inicio, hora_fim: selectedEnd.hora_fim, titulo: '' });
                        setModalReservaAberto(true);
                      } else if (selectedStart && !selectedEnd) {
                        const endItem = disponibilidade.horarios.find(h => h.hora_inicio === selectedStart.hora_inicio);
                        setReservaData({ sala_id: form.sala_id, data: form.data, hora_inicio: selectedStart.hora_inicio, hora_fim: endItem ? endItem.hora_fim : add30min(selectedStart.hora_inicio), titulo: '' });
                        setModalReservaAberto(true);
                      } else alert('Selecione um intervalo de horários.');
                    }}>+ Solicitar Reserva</button>
                  </div>
                </div>
              )}
            </>
          )}

          {modoDisponibilidade === 'data_hora' && (
            <>
              <div className="cd-filtro-card">
                <div className="cd-filtro-field">
                  <label className="cd-filtro-label">DATA</label>
                  <input className="cd-filtro-input" type="date" value={dataConsulta} onChange={(e) => setDataConsulta(e.target.value)} />
                </div>
                <div className="cd-filtro-field">
                  <label className="cd-filtro-label">INÍCIO</label>
                  <select className="cd-filtro-select" value={horaConsulta} onChange={(e) => setHoraConsulta(e.target.value)}>
                    {todosInicios.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
                <div className="cd-filtro-field">
                  <label className="cd-filtro-label">FIM</label>
                  <select className="cd-filtro-select" value={horaFimConsulta} onChange={(e) => setHoraFimConsulta(e.target.value)}>
                    {todosFins.filter(f => timeToMinutes(f) > timeToMinutes(horaConsulta)).map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
                <button className="cd-filtro-btn" onClick={handleConsultarDisponibilidadeDataHora}>Buscar salas</button>
              </div>

              {disponibilidadeDataHora && (
                <div className="cd-resultado">
                  <p className="cd-resultado-titulo">Salas disponíveis em {formatarData(dataConsulta)} das {horaConsulta} às {horaFimConsulta}</p>
                  {disponibilidadeDataHora.length === 0 ? (
                    <p className="sem-resultados">Nenhuma sala disponível nesse horário.</p>
                  ) : (
                    <div className="salas-grid-mapa">
                      {disponibilidadeDataHora.map((sala) => (
                        <div key={sala.id} className="sala-card-mapa" onClick={() => {
                          setReservaData({ sala_id: sala.id, data: dataConsulta, hora_inicio: horaConsulta, hora_fim: horaFimConsulta, titulo: '' });
                          setModalReservaAberto(true);
                        }}>
                          <div className="sala-nome-destaque">{sala.nome}</div>
                          <div className="sala-localizacao-texto">Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}</div>
                          <div className="sala-localizacao-texto">Capacidade: {sala.capacidade || '?'} pessoas</div>
                          {sala.equipamentos && (
                            <div className="sala-equipamentos-lista">
                              <div className="equipamentos-titulo">EQUIPAMENTOS</div>
                              <ul>{sala.equipamentos.split(',').map((item, idx) => <li key={idx}><span className="quadrado-roxo"></span>{item.trim()}</li>)}</ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    // GERENCIAR SALAS (admin)
    if (activeView === 'gerenciar-salas' && currentUser?.cargo === 'admin') {
      const totalOp = salas.filter(s => !s.em_manutencao).length;
      const totalMn = salas.filter(s => s.em_manutencao).length;
      return (
        <div className="gs-container">
          {(formSalaAberto || editandoSala) && (
            <div className="modal-overlay" onClick={() => { setFormSalaAberto(false); handleCancelarEdicaoSala(); }}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header-row">
                  <h3>{editandoSala ? 'Editar sala' : 'Cadastrar nova sala'}</h3>
                  <button className="modal-close-btn" onClick={() => { setFormSalaAberto(false); handleCancelarEdicaoSala(); }}>×</button>
                </div>
                <label className="modal-label">Nome *<input className="modal-input" name="nome" placeholder="Nome da sala" value={novaSala.nome} onChange={handleChangeSala} /></label>
                <label className="modal-label">Bloco<input className="modal-input" name="bloco" placeholder="Bloco (ex: 43431)" value={novaSala.bloco} onChange={handleChangeSala} /></label>
                <label className="modal-label">Andar
                  <select className="modal-input" name="andar" value={novaSala.andar} onChange={handleChangeSala}>
                    <option value="">Selecione</option>
                    <option value="1° andar">1° andar</option>
                    <option value="2° andar">2° andar</option>
                  </select>
                </label>
                <label className="modal-label">Capacidade<input className="modal-input" name="capacidade" type="number" placeholder="Nº de pessoas" value={novaSala.capacidade} onChange={handleChangeSala} /></label>
                <label className="modal-label">Equipamentos<textarea className="modal-input" name="equipamentos" rows="2" placeholder="Separados por vírgula" value={novaSala.equipamentos} onChange={handleChangeSala} /></label>
                <div className="modal-buttons">
                  <button className="secondary" onClick={() => { setFormSalaAberto(false); handleCancelarEdicaoSala(); }}>Cancelar</button>
                  <button onClick={async () => { editandoSala ? await handleUpdateSala() : await handleAdicionarSala(); setFormSalaAberto(false); }}>
                    {editandoSala ? 'Salvar alterações' : 'Cadastrar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {formManutAberto && (
            <div className="modal-overlay" onClick={() => setFormManutAberto(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header-row">
                  <h3>Bloquear sala por manutenção</h3>
                  <button className="modal-close-btn" onClick={() => setFormManutAberto(false)}>×</button>
                </div>
                <label className="modal-label">Sala
                  <select className="modal-input" name="sala_id" value={novaManutencao.sala_id} onChange={handleChangeManutencao}>
                    <option value="">Selecione</option>
                    {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </label>
                <div style={{display:'flex',gap:'12px'}}>
                  <label className="modal-label" style={{flex:1}}>Data início<input className="modal-input" type="date" name="data_inicio" value={novaManutencao.data_inicio} onChange={handleChangeManutencao} /></label>
                  <label className="modal-label" style={{flex:1}}>Data fim<input className="modal-input" type="date" name="data_fim" value={novaManutencao.data_fim} onChange={handleChangeManutencao} /></label>
                </div>
                <div style={{display:'flex',gap:'12px'}}>
                  <label className="modal-label" style={{flex:1}}>Hora início
                    <select className="modal-input" name="hora_inicio" value={novaManutencao.hora_inicio} onChange={handleChangeManutencao}>
                      {horariosManutencao.map(h => <option key={h}>{h}</option>)}
                    </select>
                  </label>
                  <label className="modal-label" style={{flex:1}}>Hora fim
                    <select className="modal-input" name="hora_fim" value={novaManutencao.hora_fim} onChange={handleChangeManutencao}>
                      {horariosManutencao.map(h => <option key={h}>{h}</option>)}
                    </select>
                  </label>
                </div>
                <label className="modal-label">Motivo<input className="modal-input" name="motivo" placeholder="Ex.: reforma, manutenção elétrica" value={novaManutencao.motivo} onChange={handleChangeManutencao} /></label>
                <div className="modal-buttons">
                  <button className="secondary" onClick={() => setFormManutAberto(false)}>Cancelar</button>
                  <button onClick={async () => { await handleCriarManutencao(); setFormManutAberto(false); }}>Bloquear</button>
                </div>
              </div>
            </div>
          )}

          <div className="gs-header">
            <div>
              <h2 className="gs-titulo">Gerenciar salas</h2>
              <p className="gs-subtitulo">Cadastre, edite ou desative salas do Centro de Biotecnologia.</p>
            </div>
            <button className="gs-btn-novo" onClick={() => { handleCancelarEdicaoSala(); setFormSalaAberto(true); }}>+ Cadastrar nova sala</button>
          </div>

          <div className="gs-stats-bar">
            <span className="gs-stats-total">{salas.length} salas cadastradas</span>
            <span className="gs-stats-detail">· {totalOp} operacionais · {totalMn} em manutenção</span>
          </div>

          <div className="gs-grid">
            {salas.map(sala => {
              const manutAtiva = manutencoes.find(m => m.sala_id === sala.id);
              return (
                <div key={sala.id} className={`gs-card${sala.em_manutencao ? ' manut' : ''}`}>
                  <div className="gs-card-faixa" />
                  <div className="gs-card-body">
                    <div className="gs-card-topo">
                      <span className="gs-sala-nome">{sala.nome}</span>
                      <span className={`gs-badge${sala.em_manutencao ? ' manut' : ' ok'}`}>
                        {sala.em_manutencao ? 'EM MANUTENÇÃO' : 'OPERACIONAL'}
                      </span>
                    </div>
                    <div className="gs-sala-info">
                      {sala.andar ? sala.andar.toUpperCase() : 'ANDAR NÃO INFORMADO'} · CAPACIDADE: {sala.capacidade || '?'} PESSOAS
                    </div>
                    {sala.equipamentos && (
                      <div className="gs-equipamentos">
                        <div className="gs-equip-titulo">EQUIPAMENTOS</div>
                        <div>{sala.equipamentos.split(',').map(e => e.trim()).join(' · ')}</div>
                      </div>
                    )}
                    {sala.em_manutencao && manutAtiva && (
                      <div className="gs-aviso-manut">
                        ⚠ Manutenção: {formatarData(manutAtiva.data_inicio)} a {formatarData(manutAtiva.data_fim)} · {manutAtiva.motivo || 'não pode ser reservada'}
                      </div>
                    )}
                    <div className="gs-card-acoes">
                      <button className="gs-btn-editar" onClick={() => { handleEditarSala(sala); setFormSalaAberto(true); }}>Editar</button>
                      {sala.em_manutencao ? (
                        <button className="gs-btn-liberar" onClick={() => handleLiberarSala(sala.id)}>Liberar para uso</button>
                      ) : (
                        <button className="gs-btn-manut" onClick={() => { setNovaManutencao(prev => ({ ...prev, sala_id: sala.id })); setFormManutAberto(true); }}>Tornar indisponível</button>
                      )}
                      <button className="gs-btn-remover" onClick={() => handleDeletarSala(sala.id, sala.nome)}>Remover</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {salas.length === 0 && <p className="admin-req-vazio">Nenhuma sala cadastrada.</p>}
        </div>
      );
    }

    // GERENCIAR USUÁRIOS (admin)
    if (activeView === 'gerenciar-usuarios' && currentUser?.cargo === 'admin') {
      const cargoLabel = { admin: 'Administrador', gerente: 'Gerente', usuario_comum: 'Usuário CBiot', usuario_externo: 'Usuário Externo' };
      const cargoBg = { admin: '#844BD4', gerente: '#3498DB', usuario_comum: '#ECE6F7', usuario_externo: '#ECE6F7' };
      const cargoFg = { admin: '#fff', gerente: '#fff', usuario_comum: '#6B5F7A', usuario_externo: '#6B5F7A' };
      return (
        <div className="gs-container">
          {alterandoPapelUser && (
            <div className="modal-overlay" onClick={() => setAlterandoPapelUser(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header-row">
                  <h3>Alterar papel de usuário</h3>
                  <button className="modal-close-btn" onClick={() => setAlterandoPapelUser(null)}>×</button>
                </div>
                <p style={{color:'#6B5F7A',fontSize:'13px',marginBottom:'16px'}}>A alteração entra em vigor imediatamente.</p>
                <div className="gu-modal-user">
                  <div className="gu-avatar">{alterandoPapelUser.nome.substring(0,2).toUpperCase()}</div>
                  <div>
                    <div style={{fontWeight:700,color:'#1A0F2B'}}>{alterandoPapelUser.nome}</div>
                    <div style={{color:'#6B5F7A',fontSize:'13px'}}>{alterandoPapelUser.email}</div>
                  </div>
                </div>
                <div className="gu-modal-papeis">
                  <div style={{flex:1}}>
                    <div className="gu-modal-label">PAPEL ATUAL</div>
                    <div className="gu-modal-atual">{cargoLabel[alterandoPapelUser.cargo] || alterandoPapelUser.cargo}</div>
                  </div>
                  <div className="gu-modal-seta">→</div>
                  <div style={{flex:1}}>
                    <div className="gu-modal-label">NOVO PAPEL</div>
                    <select className="modal-input" value={novoPapelSelecionado} onChange={e => setNovoPapelSelecionado(e.target.value)}>
                      <option value="admin">Administrador</option>
                      <option value="gerente">Gerente</option>
                      <option value="usuario_comum">Usuário CBiot</option>
                      <option value="usuario_externo">Usuário Externo</option>
                    </select>
                  </div>
                </div>
                <div className="modal-buttons">
                  <button className="secondary" onClick={() => setAlterandoPapelUser(null)}>Cancelar</button>
                  <button onClick={async () => { await handleUpdateUser(alterandoPapelUser.id, { cargo: novoPapelSelecionado }); setAlterandoPapelUser(null); }}>Confirmar alteração</button>
                </div>
              </div>
            </div>
          )}

          <div className="gs-header">
            <div>
              <h2 className="gs-titulo">Gerenciar usuários</h2>
              <p className="gs-subtitulo">Gerencie os acessos e papéis dos usuários do sistema.</p>
            </div>
          </div>

          <div className="gs-stats-bar">
            <span className="gs-stats-total">{users.length} usuários cadastrados</span>
            <span className="gs-stats-detail">
              · {users.filter(u=>u.cargo==='admin').length} administradores
              · {users.filter(u=>u.cargo==='gerente').length} gerentes
              · {users.filter(u=>u.cargo==='usuario_comum').length} usuários CBiot
            </span>
          </div>

          <div className="gu-table-header">
            <span style={{flex:3}}>USUÁRIO</span>
            <span style={{flex:3}}>E-MAIL</span>
            <span style={{flex:2}}>PAPEL</span>
            <span style={{flex:1}}>STATUS</span>
            <span style={{flex:'0 0 220px'}}>AÇÕES</span>
          </div>

          <div className="gu-rows">
            {users.map(u => (
              <div key={u.id} className="gu-row">
                <div style={{flex:3,display:'flex',alignItems:'center',gap:'10px'}}>
                  <div className="gu-avatar">{u.nome.substring(0,2).toUpperCase()}</div>
                  <div>
                    <div style={{fontWeight:700,color:'#1A0F2B',fontSize:'14px',lineHeight:1.3}}>{u.nome}</div>
                    {u.id === currentUser.id && <span className="gu-voce">você</span>}
                  </div>
                </div>
                <span style={{flex:3,color:'#6B5F7A',fontSize:'13px'}}>{u.email}</span>
                <span style={{flex:2}}>
                  <span className="gu-cargo-badge" style={{background:cargoBg[u.cargo]||'#ECE6F7',color:cargoFg[u.cargo]||'#6B5F7A'}}>
                    {(cargoLabel[u.cargo]||u.cargo).toUpperCase()}
                  </span>
                </span>
                <span style={{flex:1}}>
                  <span className="gu-status-badge" style={{background:u.status==='aprovado'?'#2ECC71':u.status==='pendente'?'#F39C12':'#95A5A6'}}>
                    {u.status==='aprovado'?'ATIVO':u.status==='pendente'?'PENDENTE':'INATIVO'}
                  </span>
                </span>
                <div style={{flex:'0 0 220px',display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
                  {u.id !== currentUser.id && (
                    <button className="gu-btn-papel" onClick={() => { setAlterandoPapelUser(u); setNovoPapelSelecionado(u.cargo); }}>Alterar papel</button>
                  )}
                  {u.status === 'pendente' && (
                    <>
                      <button className="gu-btn-aprovar" onClick={() => handleApproveUser(u.id, u.cargo)}>Aprovar</button>
                      <button className="gu-btn-sec" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Rejeitar</button>
                    </>
                  )}
                  {u.status === 'aprovado' && u.id !== currentUser.id && (
                    <button className="gu-btn-sec" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Desativar</button>
                  )}
                  {u.status === 'rejeitado' && (
                    <button className="gu-btn-sec" onClick={() => handleUpdateUser(u.id, { status: 'aprovado' })}>Reativar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {users.length === 0 && <p className="admin-req-vazio">Nenhum usuário cadastrado.</p>}
        </div>
      );
    }

    if (activeView === 'solicitacoes-reserva' && (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente')) {
  return (
    <div className="gs-container">
      <div className="gs-header">
        <div>
          <h2 className="gs-titulo">{tabSolicitacoes === 'pendentes' ? 'Solicitações pendentes' : 'Histórico de solicitações'}</h2>
          <p className="gs-subtitulo">
            {tabSolicitacoes === 'pendentes'
              ? `${solicitacoes.length} solicitações de reserva aguardando análise.`
              : 'Visualizando o histórico de reservas processadas.'}
          </p>
        </div>
        <div className="admin-req-abas">
          <button
            className={`req-aba-btn ${tabSolicitacoes === 'pendentes' ? 'active' : ''}`}
            onClick={() => setTabSolicitacoes('pendentes')}
          >
            Pendentes
          </button>
          <button
            className={`req-aba-btn ${tabSolicitacoes === 'rejeitadas' ? 'active' : ''}`}
            onClick={() => setTabSolicitacoes('rejeitadas')}
          >
            Histórico
          </button>
        </div>
      </div>

      <div className="admin-req-filtros">
        <div className="filtros-esq">
          <span className="filtros-label">ORDENAR POR:</span>
          <select className="filtros-select">
            <option>Mais recente</option>
            <option>Mais antiga</option>
          </select>
          <select className="filtros-select">
            <option>Tipo: Todos</option>
            <option>Apenas Recorrentes</option>
          </select>
        </div>
        <div className="filtros-dir">
          <span className="filtros-contagem">
            {tabSolicitacoes === 'pendentes' ? `${solicitacoes.length} pendentes` : ''}
          </span>
        </div>
      </div>

      <div className="admin-req-lista">
        {tabSolicitacoes === 'pendentes' && (
          <>
            {solicitacoes.length === 0 && <p className="admin-req-vazio">Nenhuma solicitação pendente.</p>}
            {solicitacoes.map((s) => {
              const sala = salas.find(sl => sl.id === s.sala_id);
              return (
                <div className="req-card" key={s.id}>
                  <div className="req-card-faixa"></div>
                  <div className="req-card-topo">
                    <div className="req-user-info">
                      <div className="req-avatar">{s.responsavel ? s.responsavel.substring(0, 2).toUpperCase() : 'US'}</div>
                      <div className="req-user-texto">
                        <strong>{s.responsavel}</strong>
                        <span>{s.email} · {formatarData(s.data)}</span>
                      </div>
                    </div>
                    <div className="req-tags">
                      {s.grupo_id && <span className="req-tag-azul">RECORRENTE</span>}
                      <span className="req-tag-laranja">PENDENTE</span>
                    </div>
                  </div>
                  <div className="req-card-miolo">
                    <div className="req-coluna-sala">
                      <span className="req-coluna-titulo">SALA</span>
                      <strong className="req-sala-nome">{s.sala_nome}</strong>
                      <span className="req-sala-data">{formatarData(s.data)} · {s.hora_inicio} às {s.hora_fim}</span>
                      {sala && <span className="req-sala-bloco">Bloco {sala.bloco || '?'} · Andar {sala.andar || '?'}</span>}
                    </div>
                    <div className="req-coluna-finalidade">
                      <span className="req-coluna-titulo">FINALIDADE</span>
                      <p>{s.titulo}</p>
                      {s.descricao && <p className="req-descricao-extra">{s.descricao}</p>}
                    </div>
                  </div>
                  <div className="req-card-acoes">
                    <button className="req-btn-rejeitar" onClick={() => handleRejeitarSolicitacao(s.id)}>Rejeitar</button>
                    <button className="req-btn-aprovar" onClick={() => handleAprovarSolicitacao(s.id)}>Aprovar solicitação</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tabSolicitacoes === 'rejeitadas' && (
          <>
            {rejeitadas.length === 0 && <p className="admin-req-vazio">Nenhum histórico encontrado.</p>}
            {rejeitadas.map((s) => {
              const sala = salas.find(sl => sl.id === s.sala_id);
              return (
                <div className="req-card rejeitado" key={s.id}>
                  <div className="req-card-faixa vermelha"></div>
                  <div className="req-card-topo">
                    <div className="req-user-info">
                      <div className="req-avatar">{s.responsavel ? s.responsavel.substring(0, 2).toUpperCase() : 'US'}</div>
                      <div className="req-user-texto">
                        <strong>{s.responsavel}</strong>
                        <span>{s.email}</span>
                      </div>
                    </div>
                    <div className="req-tags">
                      <span className="req-tag-vermelha">REJEITADA</span>
                    </div>
                  </div>
                  <div className="req-card-miolo">
                    <div className="req-coluna-sala">
                      <span className="req-coluna-titulo">SALA</span>
                      <strong className="req-sala-nome">{s.sala_nome}</strong>
                      <span className="req-sala-data">{formatarData(s.data)} · {s.hora_inicio} às {s.hora_fim}</span>
                    </div>
                    <div className="req-coluna-finalidade">
                      <span className="req-coluna-titulo">MOTIVO / FINALIDADE</span>
                      <p>{s.titulo}</p>
                    </div>
                  </div>
                  <div className="req-card-acoes historico-auditoria">
                    <span>Processado por <strong>{s.aprovador}</strong> em {new Date(s.data_aprovacao).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

    // MEUS DADOS
    if (activeView === 'meus-dados') {
      const cargoLabel = { admin: 'Administrador', gerente: 'Gerente', usuario_comum: 'Usuário CBiot', usuario_externo: 'Usuário Externo' };
      const cargoBg = { admin: '#844BD4', gerente: '#3498DB', usuario_comum: '#ECE6F7', usuario_externo: '#ECE6F7' };
      const cargoFg = { admin: '#fff', gerente: '#fff', usuario_comum: '#6B5F7A', usuario_externo: '#6B5F7A' };
      return (
        <div className="gs-container">
          <div className="gs-header">
            <div>
              <h2 className="gs-titulo">Meus Dados</h2>
              <p className="gs-subtitulo">Informações da sua conta no sistema.</p>
            </div>
          </div>
          <div className="meus-dados-card">
            <div className="meus-dados-avatar">{currentUser.nome.substring(0,2).toUpperCase()}</div>
            <div className="meus-dados-info">
              <div className="meus-dados-nome">{currentUser.nome}</div>
              <div className="meus-dados-email">{currentUser.email}</div>
              <span className="gu-cargo-badge" style={{background:cargoBg[currentUser.cargo]||'#ECE6F7',color:cargoFg[currentUser.cargo]||'#6B5F7A',marginTop:'8px',display:'inline-block'}}>
                {(cargoLabel[currentUser.cargo]||currentUser.cargo).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return <div>Selecione uma opção no menu.</div>;
  };

  return (
    <div className="app-layout">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
      {editandoReserva && (
        <div className="modal-overlay" onClick={() => setEditandoReserva(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Reserva</h3>
            <label>Título: <input type="text" value={editForm.titulo} onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })} /></label>
            <label>Data: <input type="date" value={editForm.data} onChange={(e) => setEditForm({ ...editForm, data: e.target.value })} /></label>
            <label>Início: <select value={editForm.hora_inicio} onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })}>{todosInicios.map(h => <option key={h}>{h}</option>)}</select></label>
            <label>Fim: <select value={editForm.hora_fim} onChange={(e) => setEditForm({ ...editForm, hora_fim: e.target.value })}>{todosFins.filter(f => timeToMinutes(f) > timeToMinutes(editForm.hora_inicio)).map(h => <option key={h}>{h}</option>)}</select></label>
            <label>Descrição: <textarea value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} rows="2" /></label>
            <div className="modal-buttons"><button onClick={handleUpdateReserva}>Salvar</button><button onClick={() => setEditandoReserva(null)}>Cancelar</button></div>
          </div>
        </div>
      )}
      <ReservaModal isOpen={modalReservaAberto} onClose={() => setModalReservaAberto(false)} salas={salas} currentUser={currentUser} userRole={currentUser.cargo === 'usuario_externo' ? 'externo' : 'interno'} initialData={reservaData} />
      <aside className="sidebar">
        <div className="sidebar-brand"><img src="/CBiot_logo.jpg" alt="CBiot" className="logo-sidebar" /><div><strong>CBiot</strong><span>Reserva de salas</span></div></div>
        <div className="sidebar-section">
          <div className="sidebar-section-title">PRINCIPAL</div>
          <button className={`sidebar-item ${activeView === 'inicio' ? 'active' : ''}`} onClick={() => setActiveView('inicio')}>Início</button>
          <button className={`sidebar-item ${activeView === 'consultar-disponibilidade' ? 'active' : ''}`} onClick={() => setActiveView('consultar-disponibilidade')}>Consultar disponibilidade</button>
          <button className={`sidebar-item ${activeView === 'minhas-reservas' ? 'active' : ''}`} onClick={() => setActiveView('minhas-reservas')}>Minhas reservas</button>
        </div>
        {(currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente') && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">ADMINISTRATIVO</div>
            <button className={`sidebar-item ${activeView === 'solicitacoes-reserva' ? 'active' : ''}`} onClick={() => setActiveView('solicitacoes-reserva')}>Solicitações de Reserva</button>
            <button className={`sidebar-item ${activeView === 'admin-reservas' ? 'active' : ''}`} onClick={() => setActiveView('admin-reservas')}>Gerenciar Reservas</button>
            {currentUser?.cargo === 'admin' && (
              <>
                <button className={`sidebar-item ${activeView === 'gerenciar-salas' ? 'active' : ''}`} onClick={() => setActiveView('gerenciar-salas')}>Gerenciar Salas</button>
                <button className={`sidebar-item ${activeView === 'gerenciar-usuarios' ? 'active' : ''}`} onClick={() => setActiveView('gerenciar-usuarios')}>Gerenciar Usuários</button>
              </>
            )}
            <button className={`sidebar-item ${activeView === 'relatorios' ? 'active' : ''}`} onClick={() => setActiveView('relatorios')}>Relatórios</button>
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
      <main className="main-content">{renderMainContent()}</main>
    </div>
  );
}

export default App;