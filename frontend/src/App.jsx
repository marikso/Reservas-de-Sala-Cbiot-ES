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
      return (
        <>
          <section className="box mapa-salas">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>🗺️ Mapa das Salas</h2>
              <button className="solicitar-reserva-btn" onClick={() => setModalReservaAberto(true)}>+ Solicitar Reserva</button>
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
        <section className="box minhas-reservas-box">
          <div className="disponibilidade-header">
            <div><h2>Minhas reservas</h2><p className="disponibilidade-sub">Acompanhe o status das suas solicitações de reserva.</p></div>
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
        </section>
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
        <section className="box minhas-reservas-box">
          <div className="disponibilidade-header">
            <div><h2>Gerenciar Reservas</h2><p className="disponibilidade-sub">Visualize todas as reservas do sistema. Selecione uma para editar ou cancelar.</p></div>
            <button className="solicitar-reserva-btn" onClick={exportarCSV}>📎 Exportar CSV</button>
          </div>
          <div className="filtros-reservas" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', margin: '1rem 0', padding: '1rem 0', borderBottom: '1px solid #e9e0f5' }}>
            <div className="filtro-busca" style={{ flex: 2, minWidth: '200px' }}>
              <input type="text" placeholder="Buscar por usuário ou sala..." value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '40px', border: '1px solid #cbd5e1' }} />
            </div>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ padding: '0.6rem 1rem', borderRadius: '40px', border: '1px solid #cbd5e1' }}>
              {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select value={filtroSala} onChange={e => setFiltroSala(e.target.value)} style={{ padding: '0.6rem 1rem', borderRadius: '40px', border: '1px solid #cbd5e1' }}>
              {salasOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} style={{ padding: '0.6rem 1rem', borderRadius: '40px', border: '1px solid #cbd5e1' }}>
              {periodoOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="reservas-stats" style={{ fontSize: '0.85rem', color: '#5a6e7c', marginBottom: '1rem' }}>
            Mostrando <strong>{reservasFiltradas.length}</strong> de <strong>{allReservas.length}</strong> reservas
            {recorrentesNoFiltro > 0 && <span> · {recorrentesNoFiltro} recorrente(s) ativa(s) no período</span>}
          </div>
          <div className="reservas-lista">
            {reservasFiltradas.length === 0 ? <p className="sem-reservas">Nenhuma reserva encontrada.</p> : reservasFiltradas.map(r => {
              const sala = salas.find(s => s.id === r.sala_id);
              const [ano, mes, dia] = r.data.split('-');
              const dataObj = new Date(Date.UTC(ano, mes-1, dia));
              const diaSemana = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'][dataObj.getUTCDay()];
              const dataFormatada = `${dia}/${mes}/${ano}`;
              let statusClass = '', statusTexto = '';
              if (r.status === 'aprovada') { statusClass = 'status-confirmada'; statusTexto = 'CONFIRMADA'; }
              else if (r.status === 'pendente') { statusClass = 'status-pendente'; statusTexto = 'PENDENTE'; }
              else { statusClass = 'status-cancelada'; statusTexto = r.status === 'rejeitada' ? 'REJEITADA' : 'CANCELADA'; }
              return (
                <div className="reserva-card-minha" key={r.id}>
                  <div className="reserva-card-header"><h3>{r.sala_nome}</h3><span className={`reserva-status ${statusClass}`}>{statusTexto}</span></div>
                  <div className="reserva-card-info">
                    <p><strong>{dataFormatada}</strong> · {diaSemana} · {r.hora_inicio} às {r.hora_fim}</p>
                    {sala && <p className="sala-localizacao-card">Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}</p>}
                    <p className="reserva-titulo">{r.titulo}</p>
                    {r.descricao && <p>Descrição: {r.descricao}</p>}
                    <p>Solicitante: {r.responsavel} ({r.email})</p>
                    {r.status === 'aprovada' && r.aprovador && <p>Aprovada por {r.aprovador} em {formatarDataHoraBrasilia(r.data_aprovacao)}</p>}
                  </div>
                  <div className="reserva-actions-minhas">
                    <button className="edit-reserva-btn" onClick={() => handleEditarReserva(r)}>Editar</button>
                    {r.grupo_id && <button className="cancel-group-btn" onClick={() => handleCancelarGrupo(r.grupo_id, false)}>Cancelar série</button>}
                    <button className="cancel-reserva-btn" onClick={() => handleCancelarReserva(r.id, r.titulo)}>Cancelar reserva</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    // RELATÓRIOS (admin/gerente)
    if (activeView === 'relatorios' && (currentUser?.cargo === 'admin' || currentUser?.cargo === 'gerente')) {
      return (
        <section className="box">
          <h2>Relatórios</h2>
          <p className="disponibilidade-sub" style={{ marginBottom: '1rem' }}>
            Este relatório exibe estatísticas das reservas de acordo com o período selecionado.
            As métricas incluem total de reservas, horas reservadas, média diária e usuários distintos.
          </p>

          <div className="relatorio-filtros" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <label>Período:</label>
            <select value={periodoRelatorio} onChange={e => {
              setPeriodoRelatorio(e.target.value);
              if (e.target.value !== 'custom') setPeriodoCustomAplicado(false);
            }} style={{ padding: '0.5rem', borderRadius: '40px', border: '1px solid #cbd5e1' }}>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="ano">Ano atual</option>
              <option value="todos">Todo histórico</option>
              <option value="custom">Personalizado...</option>
            </select>

            {periodoRelatorio === 'custom' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="date" value={dataInicioCustom} onChange={e => setDataInicioCustom(e.target.value)} style={{ padding: '0.5rem', borderRadius: '40px', border: '1px solid #cbd5e1' }} />
                <span>a</span>
                <input type="date" value={dataFimCustom} onChange={e => setDataFimCustom(e.target.value)} style={{ padding: '0.5rem', borderRadius: '40px', border: '1px solid #cbd5e1' }} />
                <button onClick={aplicarPeriodoCustom} className="solicitar-reserva-btn" style={{ padding: '0.5rem 1rem' }}>Aplicar</button>
              </div>
            )}

            <button onClick={exportarRelatorioCSV} className="solicitar-reserva-btn" style={{ marginLeft: 'auto' }}>Exportar CSV</button>
          </div>

          <div className="relatorio-metricas" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div className="metrica-card"><h3>Total reservas</h3><p>{metricas.totalReservas}</p><small>Número total de reservas no período (todos os status).</small></div>
            <div className="metrica-card"><h3>Total horas reservadas</h3><p>{metricas.totalHoras}</p><small>Soma da duração (em horas) das reservas confirmadas.</small></div>
            <div className="metrica-card"><h3>Média diária</h3><p>{metricas.mediaDiaria}</p><small>Média de reservas confirmadas por dia (últimos 30 dias).</small></div>
            <div className="metrica-card"><h3>Usuários distintos</h3><p>{metricas.usuariosDistintos}</p><small>Quantidade de usuários diferentes que fizeram reservas.</small></div>
          </div>

          <div>
            <h3>Salas mais reservadas</h3>
            <p className="info-grafico" style={{ fontSize: '0.8rem', color: '#6f4f8f', marginBottom: '0.5rem' }}>Ranking das 5 salas com maior número de reservas confirmadas no período.</p>
            <table className="ranking-table">
              <thead><tr><th>Sala</th><th>Quantidade</th></tr></thead>
              <tbody>
                {rankingSalas.map((item, idx) => <tr key={idx}><td>{item.nome}</td><td style={{ textAlign: 'center' }}>{item.qtd}</td></tr>)}
                {rankingSalas.length === 0 && <tr><td colSpan="2">Nenhuma reserva no período</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      );
    }

    // CONSULTAR DISPONIBILIDADE
    if (activeView === 'consultar-disponibilidade') {
      return (
        <section className="box disponibilidade-box">
          <div className="disponibilidade-header">
            <div><h2>Consultar disponibilidade</h2><p className="disponibilidade-sub">Clique em um horário disponível para solicitar reserva · blocos de 30 min.</p></div>
          </div>
          <div className="modo-consulta">
            <label className={`modo-radio ${modoDisponibilidade === 'sala' ? 'active' : ''}`}>
              <input type="radio" value="sala" checked={modoDisponibilidade === 'sala'} onChange={() => setModoDisponibilidade('sala')} /><span>Por sala e data</span>
            </label>
            <label className={`modo-radio ${modoDisponibilidade === 'data_hora' ? 'active' : ''}`}>
              <input type="radio" value="data_hora" checked={modoDisponibilidade === 'data_hora'} onChange={() => setModoDisponibilidade('data_hora')} /><span>Por data e hora (intervalo)</span>
            </label>
          </div>
          {modoDisponibilidade === 'sala' ? (
            <div className="consulta-sala">
              <div className="consulta-field"><label>SALA</label><select value={form.sala_id} onChange={(e) => setForm((prev) => ({ ...prev, sala_id: e.target.value }))}><option value="">Selecione uma sala</option>{salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
              <div className="consulta-field"><label>DATA</label><input type="date" value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} /></div>
              <button className="consulta-btn" onClick={handleDisponibilidade}>Ver disponibilidade</button>
            </div>
          ) : (
            <div className="consulta-data-hora">
              <div className="consulta-field"><label>Data</label><input type="date" value={dataConsulta} onChange={(e) => setDataConsulta(e.target.value)} /></div>
              <div className="consulta-field"><label>Início</label><select value={horaConsulta} onChange={(e) => setHoraConsulta(e.target.value)}>{todosInicios.map(h => <option key={h}>{h}</option>)}</select></div>
              <div className="consulta-field"><label>Fim</label><select value={horaFimConsulta} onChange={(e) => setHoraFimConsulta(e.target.value)}>{todosFins.filter(f => timeToMinutes(f) > timeToMinutes(horaConsulta)).map(h => <option key={h}>{h}</option>)}</select></div>
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
                    <p className="sala-info-detalhes">Capacidade: {salaSelecionada?.capacidade || '?'} pessoas{salaSelecionada?.andar && ` · Andar: ${salaSelecionada.andar}`}</p>
                    {salaSelecionada?.equipamentos && <p className="sala-info-detalhes">Equipamentos: {salaSelecionada.equipamentos}</p>}
                    <p className="sala-mensagem">🔑 Lembre-se: a chave da sala é retirada e devolvida na portaria. Controles remotos devem permanecer na sala.</p>
                  </div>
                );
              })()}
              <p className="horario-titulo">Horários · 08:00 às 19:00 · blocos de 30 min</p>
              <div className="horarios-grade">
                {disponibilidade.horarios.map((item) => {
                  let statusClass = '', statusText = '', isSelected = false;
                  if (item.ocupado) {
                    statusClass = item.titulo?.startsWith('Manutenção') ? 'status-manutencao' : 'status-reservado';
                    statusText = item.titulo?.startsWith('Manutenção') ? 'MANUTENÇÃO' : 'RESERVADO';
                  } else {
                    statusClass = 'status-disponivel'; statusText = 'DISPONÍVEL';
                    if (selectedStart && selectedEnd && item.hora_inicio >= selectedStart.hora_inicio && item.hora_inicio <= selectedEnd.hora_inicio) isSelected = true;
                    else if (selectedStart && !selectedEnd && item.hora_inicio === selectedStart.hora_inicio) isSelected = true;
                  }
                  if (isSelected && !item.ocupado) { statusClass = 'status-selecionado'; statusText = 'SELECIONADO'; }
                  return (
                    <div key={`${item.hora_inicio}-${item.hora_fim}`} className={`horario-card ${statusClass}`} onClick={() => {
                      if (item.ocupado) return;
                      if (!selectedStart) setSelectedStart(item);
                      else if (!selectedEnd) { if (item.hora_inicio > selectedStart.hora_inicio) setSelectedEnd(item); else setSelectedStart(item); }
                      else setSelectedStart(item);
                    }}>
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
                <button className="solicitar-reserva-btn" onClick={() => {
                  if (selectedStart && selectedEnd) {
                    setReservaData({ sala_id: form.sala_id, data: form.data, hora_inicio: selectedStart.hora_inicio, hora_fim: selectedEnd.hora_fim, titulo: '' });
                    setModalReservaAberto(true);
                  } else if (selectedStart && !selectedEnd) {
                    const endItem = disponibilidade.horarios.find(h => h.hora_inicio === selectedStart.hora_inicio);
                    setReservaData({ sala_id: form.sala_id, data: form.data, hora_inicio: selectedStart.hora_inicio, hora_fim: endItem ? endItem.hora_fim : add30min(selectedStart.hora_inicio), titulo: '' });
                    setModalReservaAberto(true);
                  } else alert('Selecione um intervalo de horários (clique no início e depois no fim).');
                }}>+ Solicitar Reserva</button>
              </div>
            </div>
          )}
          {modoDisponibilidade === 'data_hora' && disponibilidadeDataHora && (
            <div className="resultado-disponibilidade">
              <h3>Salas disponíveis em {formatarData(dataConsulta)} das {horaConsulta} às {horaFimConsulta}</h3>
              {disponibilidadeDataHora.length === 0 ? <p className="sem-resultados">Nenhuma sala disponível nesse horário.</p> : (
                <div className="salas-disponiveis-grid">
                  {disponibilidadeDataHora.map((sala) => (
                    <div key={sala.id} className="sala-card-horario" onClick={() => {
                      setReservaData({ sala_id: sala.id, data: dataConsulta, hora_inicio: horaConsulta, hora_fim: horaFimConsulta, titulo: '' });
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

    // GERENCIAR SALAS (admin) – com manutenção integrada
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

          <hr style={{ margin: '1.5rem 0' }} />

          <h3>🔧 Bloqueios por Manutenção</h3>
          <div className="admin-sala-form">
            <select name="sala_id" value={novaManutencao.sala_id} onChange={handleChangeManutencao}>
              <option value="">Selecione a sala</option>
              {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <input type="date" name="data_inicio" placeholder="Data início" value={novaManutencao.data_inicio} onChange={handleChangeManutencao} />
            <input type="date" name="data_fim" placeholder="Data fim" value={novaManutencao.data_fim} onChange={handleChangeManutencao} />
            <select name="hora_inicio" value={novaManutencao.hora_inicio} onChange={handleChangeManutencao}>
              {horariosManutencao.map(h => <option key={h}>{h}</option>)}
            </select>
            <select name="hora_fim" value={novaManutencao.hora_fim} onChange={handleChangeManutencao}>
              {horariosManutencao.map(h => <option key={h}>{h}</option>)}
            </select>
            <input name="motivo" placeholder="Motivo (ex.: reforma, manutenção elétrica)" value={novaManutencao.motivo} onChange={handleChangeManutencao} />
            <button onClick={handleCriarManutencao}>Bloquear período</button>
          </div>

          <div className="manutencoes-list">
            {manutencoes.length === 0 ? (
              <p>Nenhum bloqueio ativo.</p>
            ) : (
              manutencoes.map(m => {
                const sala = salas.find(s => s.id === m.sala_id);
                return (
                  <div key={m.id} className="manutencao-item">
                    <div>
                      <strong>{sala?.nome || 'Sala'}</strong> – {formatarData(m.data_inicio)} a {formatarData(m.data_fim)} das {m.hora_inicio} às {m.hora_fim}
                      <br />
                      <small>Motivo: {m.motivo}</small>
                    </div>
                    <button onClick={() => handleRemoverManutencao(m.id)}>Remover</button>
                  </div>
                );
              })
            )}
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
                      {u.status === 'aprovado' && <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Bloquear</button>}
                      {u.status === 'rejeitado' && <button className="small-btn" onClick={() => handleUpdateUser(u.id, { status: 'aprovado' })}>Reativar</button>}
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
        <section className="box minhas-reservas-box">
          <div className="disponibilidade-header">
            <div><h2>Solicitações de Reserva</h2><p className="disponibilidade-sub">Aprove ou rejeite as solicitações pendentes.</p></div>
          </div>
          <div className="modo-consulta" style={{ marginBottom: '1.5rem' }}>
            <label className={`modo-radio ${tabSolicitacoes === 'pendentes' ? 'active' : ''}`}>
              <input type="radio" value="pendentes" checked={tabSolicitacoes === 'pendentes'} onChange={() => setTabSolicitacoes('pendentes')} />
              <span>Pendentes ({solicitacoes.length})</span>
            </label>
            <label className={`modo-radio ${tabSolicitacoes === 'rejeitadas' ? 'active' : ''}`}>
              <input type="radio" value="rejeitadas" checked={tabSolicitacoes === 'rejeitadas'} onChange={() => setTabSolicitacoes('rejeitadas')} />
              <span>Rejeitadas ({rejeitadas.length})</span>
            </label>
          </div>
          <div className="reservas-lista">
            {tabSolicitacoes === 'pendentes' && (solicitacoes.length === 0 ? <p className="sem-reservas">Nenhuma solicitação pendente.</p> : solicitacoes.map(s => {
              const sala = salas.find(sl => sl.id === s.sala_id);
              const [ano, mes, dia] = s.data.split('-');
              const dataObj = new Date(Date.UTC(ano, mes-1, dia));
              const diaSemana = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'][dataObj.getUTCDay()];
              const dataFormatada = `${dia}/${mes}/${ano}`;
              return (
                <div className="reserva-card-minha" key={s.id}>
                  <div className="reserva-card-header"><h3>{s.sala_nome}</h3><span className="reserva-status status-pendente">PENDENTE</span></div>
                  <div className="reserva-card-info">
                    <p><strong>{dataFormatada}</strong> · {diaSemana} · {s.hora_inicio} às {s.hora_fim}</p>
                    {sala && <p className="sala-localizacao-card">Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}</p>}
                    <p className="reserva-titulo">{s.titulo}</p>
                    <p className="reserva-pendente-msg">Solicitada por {s.responsavel} ({s.email}) · em {formatarDataBrasilia(s.data_criacao || s.data)}</p>
                  </div>
                  <div className="reserva-actions-minhas"><button className="edit-reserva-btn" onClick={() => handleAprovarSolicitacao(s.id)}>Aprovar</button><button className="cancel-reserva-btn" onClick={() => handleRejeitarSolicitacao(s.id)}>Rejeitar</button></div>
                </div>
              );
            }))}
            {tabSolicitacoes === 'rejeitadas' && (rejeitadas.length === 0 ? <p className="sem-reservas">Nenhuma reserva rejeitada.</p> : rejeitadas.map(s => {
              const sala = salas.find(sl => sl.id === s.sala_id);
              const [ano, mes, dia] = s.data.split('-');
              const dataObj = new Date(Date.UTC(ano, mes-1, dia));
              const diaSemana = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'][dataObj.getUTCDay()];
              const dataFormatada = `${dia}/${mes}/${ano}`;
              return (
                <div className="reserva-card-minha" key={s.id}>
                  <div className="reserva-card-header"><h3>{s.sala_nome}</h3><span className="reserva-status status-cancelada">REJEITADA</span></div>
                  <div className="reserva-card-info">
                    <p><strong>{dataFormatada}</strong> · {diaSemana} · {s.hora_inicio} às {s.hora_fim}</p>
                    {sala && <p className="sala-localizacao-card">Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}</p>}
                    <p className="reserva-titulo">{s.titulo}</p>
                    <p className="reserva-rejeitada-msg">Rejeitada por {s.aprovador} em {formatarDataHoraBrasilia(s.data_aprovacao)}</p>
                  </div>
                  <div className="reserva-actions-minhas"><button className="detalhes-reserva-btn" onClick={() => alert(`Detalhes da reserva rejeitada:\nTítulo: ${s.titulo}\nSala: ${s.sala_nome}\nData: ${dataFormatada}\nHorário: ${s.hora_inicio} - ${s.hora_fim}`)}>Ver detalhes</button></div>
                </div>
              );
            }))}
          </div>
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