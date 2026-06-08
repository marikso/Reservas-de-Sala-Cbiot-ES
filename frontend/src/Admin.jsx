import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getSalas,
  createSala,
  updateSala,
  deleteSala,
  getReservas,
  deleteReserva,
  updateReserva,
  deleteReservasByGrupo,
  getUsers,
  updateUser,
  approveUser,
  whoami,
} from './api';

const generateTimeOptions = () => {
  const times = [];
  for (let i = 8; i < 19; i++) {
    times.push(`${String(i).padStart(2, '0')}:00`);
    if (i < 18) times.push(`${String(i).padStart(2, '0')}:30`);
  }
  return times;
};

function AdminPanel() {
  // ========== ESTADOS GERAIS ==========
  const [salas, setSalas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [users, setUsers] = useState([]);
  const [novaSala, setNovaSala] = useState({ nome: '', bloco: '', andar: '', capacidade: '', equipamentos: '' });
  const [editandoSala, setEditandoSala] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  const [manutencoes, setManutencoes] = useState([]);
  const [novaManutencao, setNovaManutencao] = useState({
    sala_id: '',
    data_inicio: '',
    data_fim: '',
    hora_inicio: '08:00',
    hora_fim: '09:00',
    motivo: '',
  });
  const horarios = generateTimeOptions();

  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([]);
  const [solicitacoesRejeitadas, setSolicitacoesRejeitadas] = useState([]);
  const [tabSolicitacoes, setTabSolicitacoes] = useState('pendentes');
  const [activeTabAdmin, setActiveTabAdmin] = useState('salas'); // controla qual aba está ativa

  const [editandoReserva, setEditandoReserva] = useState(null);
  const [editForm, setEditForm] = useState({
    titulo: '',
    descricao: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
  });

  // ========== ESTADOS PARA RELATÓRIOS ==========
  const [periodoRelatorio, setPeriodoRelatorio] = useState('30d');
  const [metricas, setMetricas] = useState({ totalReservas: 0, totalHoras: 0, mediaDiaria: 0, usuariosDistintos: 0 });
  const [statusDist, setStatusDist] = useState({ aprovada: 0, pendente: 0, rejeitada: 0, cancelada: 0 });
  const [rankingSalas, setRankingSalas] = useState([]);
  const chartRef = useRef(null);
  const statusChartRef = useRef(null);
  let dailyChart = useRef(null);
  let pieChart = useRef(null);

  // ========== FUNÇÕES AUXILIARES ==========
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

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ========== CARREGAMENTO DE DADOS ==========
  const loadSalas = async () => {
    const data = await getSalas();
    setSalas(data.sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true })));
  };
  const loadReservas = async () => {
    const data = await getReservas();
    setReservas(data);
  };
  const loadManutencoes = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/manutencoes', { credentials: 'include' });
      setManutencoes(await res.json());
    } catch (err) { console.error(err); }
  };
  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) { console.error(err); }
  };
  const loadSolicitacoesPendentes = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/solicitacoes', { credentials: 'include' });
      if (res.ok) setSolicitacoesPendentes(await res.json());
    } catch (err) { console.error(err); }
  };
  const loadSolicitacoesRejeitadas = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/solicitacoes/rejeitadas', { credentials: 'include' });
      if (res.ok) setSolicitacoesRejeitadas(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    whoami().then(u => {
      if (u && (u.cargo === 'admin' || u.cargo === 'gerente')) setCurrentUser(u);
      else navigate('/');
    });
    loadSalas(); loadReservas(); loadManutencoes(); loadUsers();
    loadSolicitacoesPendentes(); loadSolicitacoesRejeitadas();
  }, []);

  // ========== LÓGICA DOS RELATÓRIOS ==========
  const getReservasPorPeriodo = () => {
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
      return reservas.filter(r => new Date(r.data) >= dataLimite);
    }
    return reservas;
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

    const reservasPorDia = {};
    reservasAprovadas.forEach(r => { reservasPorDia[r.data] = (reservasPorDia[r.data] || 0) + 1; });
    const labels = Object.keys(reservasPorDia).sort();
    const data = labels.map(d => reservasPorDia[d]);
    // Atualizar gráficos (Chart.js)
    if (dailyChart.current) dailyChart.current.destroy();
    if (pieChart.current) pieChart.current.destroy();
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      if (ctx && labels.length) {
        import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js').then(Chart => {
          dailyChart.current = new Chart.default(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Reservas', data, backgroundColor: '#8e44ad' }] },
            options: { responsive: true, maintainAspectRatio: false }
          });
        });
      }
    }
    if (statusChartRef.current) {
      const ctx = statusChartRef.current.getContext('2d');
      if (ctx) {
        import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js').then(Chart => {
          pieChart.current = new Chart.default(ctx, {
            type: 'pie',
            data: {
              labels: ['Confirmadas', 'Pendentes', 'Rejeitadas', 'Canceladas'],
              datasets: [{ data: [statusDist.aprovada, statusDist.pendente, statusDist.rejeitada, statusDist.cancelada], backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
          });
        });
      }
    }
    const salasCount = {};
    reservasAprovadas.forEach(r => { salasCount[r.sala_nome] = (salasCount[r.sala_nome] || 0) + 1; });
    const ranking = Object.entries(salasCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, qtd]) => ({ nome, qtd }));
    setRankingSalas(ranking);
  };

  useEffect(() => {
    if (activeTabAdmin === 'relatorios') atualizarRelatorios();
  }, [periodoRelatorio, reservas, activeTabAdmin]);

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
    link.download = `relatorio_reservas_${periodoRelatorio}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ========== GERENCIAR SALAS ==========
  const handleChangeSala = (e) => setNovaSala({ ...novaSala, [e.target.name]: e.target.value });
  const handleAdicionarSala = async () => {
    if (!novaSala.nome.trim()) return showToast('Informe o nome da sala', 'error');
    const res = await createSala(novaSala);
    if (res.erro) showToast(res.erro, 'error');
    else { setNovaSala({ nome: '', bloco: '', andar: '', capacidade: '', equipamentos: '' }); await loadSalas(); showToast('Sala criada!'); }
  };
  const handleEditarSala = (sala) => { setEditandoSala(sala); setNovaSala({ ...sala }); };
  const handleCancelarEdicao = () => { setEditandoSala(null); setNovaSala({ nome: '', bloco: '', andar: '', capacidade: '', equipamentos: '' }); };
  const handleUpdateSala = async () => {
    if (!novaSala.nome.trim()) return showToast('Informe o nome da sala', 'error');
    const res = await updateSala(editandoSala.id, novaSala);
    if (res.erro) showToast(res.erro, 'error');
    else { showToast(`Sala "${novaSala.nome}" atualizada!`); setEditandoSala(null); setNovaSala({ nome: '', bloco: '', andar: '', capacidade: '', equipamentos: '' }); await loadSalas(); }
  };
  const handleDeletarSala = async (id, nome) => {
    if (window.confirm(`Excluir a sala "${nome}"?`)) {
      await deleteSala(id); await loadSalas(); await loadReservas(); showToast(`Sala "${nome}" excluída!`);
    }
  };

  // ========== RESERVAS (GERENCIAR) ==========
  const handleDeletarReserva = async (id, titulo) => { await deleteReserva(id); await loadReservas(); showToast(`Reserva "${titulo}" cancelada!`); };
  const handleDeletarGrupo = async (grupoId) => {
    if (window.confirm('Cancelar TODAS as reservas deste grupo recorrente?')) {
      const res = await deleteReservasByGrupo(grupoId);
      if (res.erro) showToast(res.erro, 'error');
      else { await loadReservas(); showToast(res.mensagem, 'success'); }
    }
  };
  const handleEditarReserva = (reserva) => { setEditandoReserva(reserva); setEditForm({ titulo: reserva.titulo, descricao: reserva.descricao || '', data: reserva.data, hora_inicio: reserva.hora_inicio, hora_fim: reserva.hora_fim }); };
  const handleUpdateReserva = async () => {
    if (!editandoReserva) return;
    const res = await updateReserva(editandoReserva.id, editForm);
    if (res.erro) showToast(res.erro, 'error');
    else { showToast('Reserva atualizada!'); setEditandoReserva(null); await loadReservas(); }
  };

  // ========== SOLICITAÇÕES ==========
  const handleAprovarSolicitacao = async (id) => {
    const res = await fetch(`http://localhost:5000/api/solicitacoes/${id}/aprovar`, { method: 'POST', credentials: 'include' });
    if (res.ok) { showToast('Reserva aprovada!'); loadSolicitacoesPendentes(); loadSolicitacoesRejeitadas(); loadReservas(); }
    else showToast((await res.json()).erro || 'Erro ao aprovar', 'error');
  };
  const handleRejeitarSolicitacao = async (id) => {
    if (window.confirm('Rejeitar esta solicitação?')) {
      const res = await fetch(`http://localhost:5000/api/solicitacoes/${id}/rejeitar`, { method: 'POST', credentials: 'include' });
      if (res.ok) { showToast('Solicitação rejeitada'); loadSolicitacoesPendentes(); loadSolicitacoesRejeitadas(); }
      else showToast((await res.json()).erro || 'Erro ao rejeitar', 'error');
    }
  };

  // ========== MANUTENÇÕES ==========
  const handleChangeManutencao = (e) => setNovaManutencao({ ...novaManutencao, [e.target.name]: e.target.value });
  const handleCriarManutencao = async () => {
    if (!novaManutencao.sala_id || !novaManutencao.data_inicio || !novaManutencao.data_fim || !novaManutencao.motivo) return showToast('Preencha todos os campos', 'error');
    try {
      const res = await fetch('http://localhost:5000/api/manutencoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(novaManutencao) });
      const data = await res.json();
      if (!res.ok) showToast(data.erro || 'Erro ao criar bloqueio', 'error');
      else { showToast('Bloqueio criado'); setNovaManutencao({ sala_id: '', data_inicio: '', data_fim: '', hora_inicio: '08:00', hora_fim: '09:00', motivo: '' }); loadManutencoes(); loadSalas(); }
    } catch(err) { showToast('Erro de conexão', 'error'); }
  };
  const handleRemoverManutencao = async (id) => {
    if (window.confirm('Remover este bloqueio?')) {
      try {
        const res = await fetch(`http://localhost:5000/api/manutencoes/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { showToast('Bloqueio removido'); loadManutencoes(); loadSalas(); }
        else showToast((await res.json()).erro || 'Erro ao remover', 'error');
      } catch(err) { showToast('Erro de conexão', 'error'); }
    }
  };

  // ========== USUÁRIOS ==========
  const handleUpdateUser = async (userId, data) => {
    const res = await updateUser(userId, data);
    if (res.erro) showToast(res.erro, 'error');
    else { showToast('Usuário atualizado'); loadUsers(); }
  };
  const handleApproveUser = async (userId, cargo) => {
    const res = await approveUser(userId, cargo);
    if (res.erro) showToast(res.erro, 'error');
    else { showToast('Usuário aprovado'); loadUsers(); }
  };

  if (!currentUser) return <div>Verificando permissões...</div>;

  // ========== RENDERIZAÇÃO PRINCIPAL ==========
  return (
    <div className="admin-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
      {editandoReserva && (
        <div className="modal-overlay" onClick={() => setEditandoReserva(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Editar Reserva</h3>
            <label>Título: <input type="text" value={editForm.titulo} onChange={e => setEditForm({ ...editForm, titulo: e.target.value })} /></label>
            <label>Data: <input type="date" value={editForm.data} onChange={e => setEditForm({ ...editForm, data: e.target.value })} /></label>
            <label>Início: <select value={editForm.hora_inicio} onChange={e => setEditForm({ ...editForm, hora_inicio: e.target.value })}>{horarios.map(h => <option key={h}>{h}</option>)}</select></label>
            <label>Fim: <select value={editForm.hora_fim} onChange={e => setEditForm({ ...editForm, hora_fim: e.target.value })}>{horarios.filter(f => {
              const inicioMin = parseInt(editForm.hora_inicio.split(':')[0])*60 + parseInt(editForm.hora_inicio.split(':')[1]);
              const fimMin = parseInt(f.split(':')[0])*60 + parseInt(f.split(':')[1]);
              return fimMin > inicioMin;
            }).map(h => <option key={h}>{h}</option>)}</select></label>
            <label>Descrição: <textarea value={editForm.descricao} onChange={e => setEditForm({ ...editForm, descricao: e.target.value })} rows="2" /></label>
            <div className="modal-buttons"><button onClick={handleUpdateReserva}>Salvar</button><button onClick={() => setEditandoReserva(null)}>Cancelar</button></div>
          </div>
        </div>
      )}

      <header className="admin-header">
        <div className="header-content"><img src="/CBiot_logo.jpg" alt="Logo CBiot" className="logo" /><h1 className="central-title">Administração - Reserva de Salas CBiot</h1></div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><span>{currentUser.nome} ({currentUser.cargo})</span><Link to="/app" className="back-button">Voltar ao sistema</Link></div>
      </header>

      {/* Abas */}
      <div className="admin-tabs">
        <button className={`admin-tab ${activeTabAdmin === 'salas' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('salas')}>Salas</button>
        <button className={`admin-tab ${activeTabAdmin === 'manutencoes' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('manutencoes')}>Manutenções</button>
        <button className={`admin-tab ${activeTabAdmin === 'solicitacoes' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('solicitacoes')}>Solicitações</button>
        <button className={`admin-tab ${activeTabAdmin === 'reservas' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('reservas')}>Reservas</button>
        <button className={`admin-tab ${activeTabAdmin === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('usuarios')}>Usuários</button>
        <button className={`admin-tab ${activeTabAdmin === 'relatorios' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('relatorios')}>Relatórios</button>
      </div>

      <div className="admin-tab-content">
        {/* ABa SALAS */}
        {activeTabAdmin === 'salas' && (
          <section className="box">
            <h2>Gerenciar Salas</h2>
            <div className="admin-sala-form">
              <input name="nome" placeholder="Nome da sala" value={novaSala.nome} onChange={handleChangeSala} />
              <input name="bloco" placeholder="Bloco" value={novaSala.bloco} onChange={handleChangeSala} />
              <select name="andar" value={novaSala.andar} onChange={handleChangeSala}><option value="">Andar</option><option value="1° andar">1° andar</option><option value="2° andar">2° andar</option></select>
              <input name="capacidade" placeholder="Capacidade (pessoas)" type="number" value={novaSala.capacidade} onChange={handleChangeSala} />
              <textarea name="equipamentos" placeholder="Equipamentos (separados por vírgula)" value={novaSala.equipamentos} onChange={handleChangeSala} rows="2" />
              {editandoSala ? (
                <div style={{ display: 'flex', gap: '1rem' }}><button onClick={handleUpdateSala}>Salvar</button><button onClick={handleCancelarEdicao} className="secondary">Cancelar</button></div>
              ) : (
                <button onClick={handleAdicionarSala}>Adicionar sala</button>
              )}
            </div>
            <div className="salas-grid-mapa">
              {salas.map(sala => (
                <div key={sala.id} className={`sala-card-mapa ${sala.em_manutencao ? 'manutencao' : ''}`}>
                  <div className="sala-nome">{sala.nome}</div>
                  <div className="sala-localizacao">📍 Bloco {sala.bloco || '?'} | {sala.andar || '?'}</div>
                  <div className="sala-info">👥 Capacidade: {sala.capacidade || '?'} pessoas</div>
                  {sala.equipamentos && <div className="sala-equipamentos"><strong>📋 Equipamentos:</strong><ul>{sala.equipamentos.split(',').map((item,i) => <li key={i}>{item.trim()}</li>)}</ul></div>}
                  {sala.em_manutencao && <div className="sala-manutencao-badge">🔧 Em manutenção</div>}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}><button className="edit-sala-btn" onClick={() => handleEditarSala(sala)}>Editar</button><button className="delete-sala-btn" onClick={() => handleDeletarSala(sala.id, sala.nome)}>Excluir</button></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ABA MANUTENÇÕES */}
        {activeTabAdmin === 'manutencoes' && (
          <section className="box">
            <h2>Bloqueios por Manutenção</h2>
            <div className="admin-sala-form">
              <select name="sala_id" value={novaManutencao.sala_id} onChange={handleChangeManutencao}><option value="">Selecione a sala</option>{salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
              <input type="date" name="data_inicio" placeholder="Data início" value={novaManutencao.data_inicio} onChange={handleChangeManutencao} />
              <input type="date" name="data_fim" placeholder="Data fim" value={novaManutencao.data_fim} onChange={handleChangeManutencao} />
              <select name="hora_inicio" value={novaManutencao.hora_inicio} onChange={handleChangeManutencao}>{horarios.map(h => <option key={h}>{h}</option>)}</select>
              <select name="hora_fim" value={novaManutencao.hora_fim} onChange={handleChangeManutencao}>{horarios.map(h => <option key={h}>{h}</option>)}</select>
              <input name="motivo" placeholder="Motivo (ex.: reforma)" value={novaManutencao.motivo} onChange={handleChangeManutencao} />
              <button onClick={handleCriarManutencao}>Bloquear período</button>
            </div>
            <div className="manutencoes-list">
              {manutencoes.map(m => (
                <div key={m.id} className="manutencao-item">
                  <div><strong>{m.sala_nome}</strong> – {formatarData(m.data_inicio)} a {formatarData(m.data_fim)} das {m.hora_inicio} às {m.hora_fim}<br /><small>Motivo: {m.motivo}</small></div>
                  <button onClick={() => handleRemoverManutencao(m.id)}>Remover</button>
                </div>
              ))}
              {manutencoes.length === 0 && <p>Nenhum bloqueio ativo.</p>}
            </div>
          </section>
        )}

        {/* ABA SOLICITAÇÕES */}
        {activeTabAdmin === 'solicitacoes' && (
          <section className="box minhas-reservas-box">
            <div className="disponibilidade-header"><div><h2>Solicitações de Reserva</h2><p className="disponibilidade-sub">Aprove ou rejeite as solicitações pendentes.</p></div></div>
            <div className="modo-consulta" style={{ marginBottom: '1.5rem' }}>
              <label className={`modo-radio ${tabSolicitacoes === 'pendentes' ? 'active' : ''}`}><input type="radio" value="pendentes" checked={tabSolicitacoes === 'pendentes'} onChange={() => setTabSolicitacoes('pendentes')} /><span>Pendentes ({solicitacoesPendentes.length})</span></label>
              <label className={`modo-radio ${tabSolicitacoes === 'rejeitadas' ? 'active' : ''}`}><input type="radio" value="rejeitadas" checked={tabSolicitacoes === 'rejeitadas'} onChange={() => setTabSolicitacoes('rejeitadas')} /><span>Rejeitadas ({solicitacoesRejeitadas.length})</span></label>
            </div>
            <div className="reservas-lista">
              {tabSolicitacoes === 'pendentes' && (solicitacoesPendentes.length === 0 ? <p className="sem-reservas">Nenhuma solicitação pendente.</p> : solicitacoesPendentes.map(s => {
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
                      {sala && <p className="sala-localizacao-card">Bloco {sala.bloco || '?'} · {sala.andar || '?'}</p>}
                      <p className="reserva-titulo">{s.titulo}</p>
                      <p className="reserva-pendente-msg">Solicitada por {s.responsavel} ({s.email}) · em {formatarDataBrasilia(s.data_criacao || s.data)}</p>
                    </div>
                    <div className="reserva-actions-minhas"><button className="edit-reserva-btn" onClick={() => handleAprovarSolicitacao(s.id)}>Aprovar</button><button className="cancel-reserva-btn" onClick={() => handleRejeitarSolicitacao(s.id)}>Rejeitar</button></div>
                  </div>
                );
              }))}
              {tabSolicitacoes === 'rejeitadas' && (solicitacoesRejeitadas.length === 0 ? <p className="sem-reservas">Nenhuma reserva rejeitada.</p> : solicitacoesRejeitadas.map(s => {
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
                      {sala && <p className="sala-localizacao-card">Bloco {sala.bloco || '?'} · {sala.andar || '?'}</p>}
                      <p className="reserva-titulo">{s.titulo}</p>
                      <p className="reserva-rejeitada-msg">Rejeitada por {s.aprovador} em {formatarDataHoraBrasilia(s.data_aprovacao)}</p>
                    </div>
                    <div className="reserva-actions-minhas"><button className="detalhes-reserva-btn" onClick={() => alert(`Detalhes:\nTítulo: ${s.titulo}\nSala: ${s.sala_nome}\nData: ${dataFormatada}\nHorário: ${s.hora_inicio} - ${s.hora_fim}`)}>Ver detalhes</button></div>
                  </div>
                );
              }))}
            </div>
          </section>
        )}

        {/* ABA RESERVAS (GERENCIAR) */}
        {activeTabAdmin === 'reservas' && (
          <section className="box minhas-reservas-box">
            <div className="disponibilidade-header"><div><h2>Gerenciar Reservas</h2><p className="disponibilidade-sub">Todas as reservas do sistema.</p></div></div>
            <div className="reservas-lista">
              {reservas.length === 0 ? <p className="sem-reservas">Nenhuma reserva encontrada.</p> : reservas.map(r => {
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
                      {sala && <p className="sala-localizacao-card">Bloco {sala.bloco || '?'} · {sala.andar || '?'}</p>}
                      <p className="reserva-titulo">{r.titulo}</p>
                      {r.descricao && <p>Descrição: {r.descricao}</p>}
                      <p>Solicitante: {r.responsavel} ({r.email})</p>
                      {r.status === 'aprovada' && r.aprovador && <p>Aprovada por {r.aprovador} em {formatarDataHoraBrasilia(r.data_aprovacao)}</p>}
                      {r.status === 'rejeitada' && r.aprovador && <p>Rejeitada por {r.aprovador} em {formatarDataHoraBrasilia(r.data_aprovacao)}</p>}
                    </div>
                    <div className="reserva-actions-minhas">
                      <button className="edit-reserva-btn" onClick={() => handleEditarReserva(r)}>Editar</button>
                      {r.grupo_id && <button className="cancel-group-btn" onClick={() => handleDeletarGrupo(r.grupo_id)}>Cancelar série</button>}
                      <button className="cancel-reserva-btn" onClick={() => handleDeletarReserva(r.id, r.titulo)}>Cancelar reserva</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ABA USUÁRIOS (apenas admin) */}
        {activeTabAdmin === 'usuarios' && currentUser.cargo === 'admin' && (
          <section className="box">
            <h2>Gerenciar Usuários</h2>
            <div className="users-table-container">
              <table className="users-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.nome}</td><td>{u.email}</td>
                    <td><select value={u.cargo} onChange={e => handleUpdateUser(u.id, { cargo: e.target.value })}><option value="aluno">Aluno</option><option value="professor">Professor</option><option value="gerente">Gerente</option><option value="admin">Admin</option></select></td>
                    <td>{u.status}</td>
                    <td>
                      {u.status === 'pendente' && (<><button className="small-btn" onClick={() => handleApproveUser(u.id, u.cargo)}>Aprovar</button><button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Rejeitar</button></>)}
                      {u.status === 'aprovado' && <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Bloquear</button>}
                      {u.status === 'rejeitado' && <button className="small-btn" onClick={() => handleUpdateUser(u.id, { status: 'aprovado' })}>Reativar</button>}
                    </td>
                  </tr>
                ))}
              </tbody></table>
              {users.length === 0 && <p>Nenhum usuário cadastrado.</p>}
            </div>
          </section>
        )}

        {/* ABA RELATÓRIOS */}
        {activeTabAdmin === 'relatorios' && (
          <section className="box">
            <h2>Relatórios</h2>
            <div className="relatorio-filtros" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <label>Período:</label>
              <select value={periodoRelatorio} onChange={e => setPeriodoRelatorio(e.target.value)}>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
                <option value="ano">Ano atual</option>
                <option value="todos">Todo histórico</option>
              </select>
              <button onClick={exportarRelatorioCSV} className="solicitar-reserva-btn">Exportar CSV</button>
            </div>
            <div className="relatorio-metricas" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <div className="metrica-card"><h3>Total reservas</h3><p>{metricas.totalReservas}</p></div>
              <div className="metrica-card"><h3>Total horas reservadas</h3><p>{metricas.totalHoras}</p></div>
              <div className="metrica-card"><h3>Média diária</h3><p>{metricas.mediaDiaria}</p></div>
              <div className="metrica-card"><h3>Usuários distintos</h3><p>{metricas.usuariosDistintos}</p></div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <h3>Reservas por dia</h3>
                <canvas ref={chartRef} width="400" height="200" style={{ maxWidth: '100%' }}></canvas>
              </div>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <h3>Distribuição por status</h3>
                <canvas ref={statusChartRef} width="300" height="200" style={{ maxWidth: '100%' }}></canvas>
              </div>
            </div>
            <div>
              <h3>Salas mais reservadas</h3>
              <table className="ranking-table">
                <thead><tr><th>Sala</th><th>Quantidade</th></tr></thead>
                <tbody>
                  {rankingSalas.map((item, idx) => <tr key={idx}><td>{item.nome}</td><td style={{ textAlign: 'center' }}>{item.qtd}</td></tr>)}
                  {rankingSalas.length === 0 && <tr><td colSpan="2">Nenhuma reserva no período</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <footer className="admin-footer"><Link to="/ReservaDeSalas" className="back-button">← Voltar ao sistema</Link></footer>
    </div>
  );
}

export default function Admin() {
  const [isAllowed, setIsAllowed] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    whoami().then(u => { if (u && (u.cargo === 'admin' || u.cargo === 'gerente')) setIsAllowed(true); else navigate('/'); }).catch(() => navigate('/'));
  }, []);
  return isAllowed ? <AdminPanel /> : null;
}