import { useEffect, useState } from 'react';
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

// Geração de opções de horário (08:00 às 19:00 com intervalos de 30 min)
const generateTimeOptions = () => {
  const times = [];
  for (let i = 8; i < 19; i++) {
    times.push(`${String(i).padStart(2, '0')}:00`);
    if (i < 18) times.push(`${String(i).padStart(2, '0')}:30`);
  }
  return times;
};

function AdminPanel() {
  // ========== ESTADOS ==========
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

  // Solicitações de reserva (pendentes e rejeitadas)
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([]);
  const [solicitacoesRejeitadas, setSolicitacoesRejeitadas] = useState([]);
  const [tabSolicitacoes, setTabSolicitacoes] = useState('pendentes');

  // Edição de reserva
  const [editandoReserva, setEditandoReserva] = useState(null);
  const [editForm, setEditForm] = useState({
    titulo: '',
    descricao: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
  });

  // ========== FUNÇÕES AUXILIARES ==========
  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const formatarDataHoraUTC = (isoString) => {
    if (!isoString) return '';
    const data = new Date(isoString);
    const dia = data.getUTCDate().toString().padStart(2, '0');
    const mes = (data.getUTCMonth() + 1).toString().padStart(2, '0');
    const ano = data.getUTCFullYear();
    const horas = data.getUTCHours().toString().padStart(2, '0');
    const minutos = data.getUTCMinutes().toString().padStart(2, '0');
    return `${dia}/${mes}/${ano}, ${horas}:${minutos}`;
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ========== CARREGAMENTO DE DADOS ==========
  const loadSalas = async () => {
    const data = await getSalas();
    const sorted = [...data].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));
    setSalas(sorted);
  };
  const loadReservas = async () => {
    const data = await getReservas();
    setReservas(data);
  };
  const loadManutencoes = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/manutencoes', { credentials: 'include' });
      const data = await res.json();
      setManutencoes(data);
    } catch (err) {
      console.error('Erro ao carregar manutenções', err);
    }
  };
  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Erro ao carregar usuários', err);
    }
  };
  const loadSolicitacoesPendentes = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/solicitacoes', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSolicitacoesPendentes(data);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const loadSolicitacoesRejeitadas = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/solicitacoes/rejeitadas', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSolicitacoesRejeitadas(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    whoami().then((u) => {
      if (u && (u.cargo === 'admin' || u.cargo === 'gerente')) setCurrentUser(u);
      else navigate('/');
    });
    loadSalas();
    loadReservas();
    loadManutencoes();
    loadUsers();
    loadSolicitacoesPendentes();
    loadSolicitacoesRejeitadas();
  }, []);

  // ========== GERENCIAR SALAS ==========
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
    setNovaSala({ ...sala });
  };
  const handleCancelarEdicao = () => {
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
      await loadReservas();
      showToast(`Sala "${nome}" excluída!`);
    }
  };

  // ========== GERENCIAR RESERVAS (admin) ==========
  const handleDeletarReserva = async (id, titulo) => {
    await deleteReserva(id);
    await loadReservas();
    showToast(`Reserva "${titulo}" cancelada!`);
  };
  const handleDeletarGrupo = async (grupoId) => {
    if (window.confirm('Cancelar TODAS as reservas deste grupo recorrente?')) {
      const res = await deleteReservasByGrupo(grupoId);
      if (res.erro) showToast(res.erro, 'error');
      else {
        await loadReservas();
        showToast(res.mensagem, 'success');
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
      await loadReservas();
    }
  };

  // ========== SOLICITAÇÕES (APROVAR/REJEITAR) ==========
  const handleAprovarSolicitacao = async (id) => {
    const res = await fetch(`http://localhost:5000/api/solicitacoes/${id}/aprovar`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      showToast('Reserva aprovada!', 'success');
      loadSolicitacoesPendentes();
      loadSolicitacoesRejeitadas();
      loadReservas();
    } else {
      const err = await res.json();
      showToast(err.erro || 'Erro ao aprovar', 'error');
    }
  };
  const handleRejeitarSolicitacao = async (id) => {
    if (window.confirm('Rejeitar esta solicitação?')) {
      const res = await fetch(`http://localhost:5000/api/solicitacoes/${id}/rejeitar`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        showToast('Solicitação rejeitada', 'success');
        loadSolicitacoesPendentes();
        loadSolicitacoesRejeitadas();
      } else {
        const err = await res.json();
        showToast(err.erro || 'Erro ao rejeitar', 'error');
      }
    }
  };

  // ========== MANUTENÇÕES ==========
  const handleChangeManutencao = (e) => {
    const { name, value } = e.target;
    setNovaManutencao((prev) => ({ ...prev, [name]: value }));
  };
  const handleCriarManutencao = async () => {
    if (!novaManutencao.sala_id || !novaManutencao.data_inicio || !novaManutencao.data_fim || !novaManutencao.motivo) {
      showToast('Preencha todos os campos da manutenção', 'error');
      return;
    }
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
        loadManutencoes();
        loadSalas();
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
          loadManutencoes();
          loadSalas();
        } else {
          const err = await res.json();
          showToast(err.erro || 'Erro ao remover', 'error');
        }
      } catch (err) {
        showToast('Erro de conexão', 'error');
      }
    }
  };

  // ========== USUÁRIOS ==========
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

  // ========== RENDERIZAÇÃO DE CARD DE RESERVA (mesmo visual de "Minhas Reservas") ==========
  const renderReservaCard = (r) => {
    const sala = salas.find((s) => s.id === r.sala_id);
    const [ano, mes, dia] = r.data.split('-');
    const dataObj = new Date(Date.UTC(ano, mes - 1, dia));
    const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const diaSemana = diasSemana[dataObj.getUTCDay()];
    const dataFormatada = `${dia}/${mes}/${ano}`;

    let statusClass = '';
    let statusTexto = '';
    if (r.status === 'aprovada') {
      statusClass = 'status-confirmada';
      statusTexto = 'CONFIRMADA';
    } else if (r.status === 'pendente') {
      statusClass = 'status-pendente';
      statusTexto = 'PENDENTE';
    } else {
      statusClass = 'status-cancelada';
      statusTexto = r.status === 'rejeitada' ? 'REJEITADA' : 'CANCELADA';
    }

    return (
      <div className="reserva-card-minha" key={r.id}>
        <div className="reserva-card-header">
          <h3>{r.sala_nome}</h3>
          <span className={`reserva-status ${statusClass}`}>{statusTexto}</span>
        </div>
        <div className="reserva-card-info">
          <p>
            <strong>{dataFormatada}</strong> · {diaSemana} · {r.hora_inicio} às {r.hora_fim}
          </p>
          {sala && (
            <p className="sala-localizacao-card">
              Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}
            </p>
          )}
          <p className="reserva-titulo">{r.titulo}</p>
          {r.descricao && <p>Descrição: {r.descricao}</p>}
          <p>Solicitante: {r.responsavel} ({r.email})</p>
          {r.status === 'aprovada' && r.aprovador && (
            <p>Aprovada por {r.aprovador} em {formatarDataHoraUTC(r.data_aprovacao)}</p>
          )}
          {r.status === 'rejeitada' && r.aprovador && (
            <p>Rejeitada por {r.aprovador} em {formatarDataHoraUTC(r.data_aprovacao)}</p>
          )}
        </div>
        <div className="reserva-actions-minhas">
          <button className="edit-reserva-btn" onClick={() => handleEditarReserva(r)}>
            Editar solicitação
          </button>
          {r.grupo_id && (
            <button className="cancel-group-btn" onClick={() => handleDeletarGrupo(r.grupo_id)}>
              Cancelar série
            </button>
          )}
          <button className="cancel-reserva-btn" onClick={() => handleDeletarReserva(r.id, r.titulo)}>
            Cancelar solicitação
          </button>
        </div>
      </div>
    );
  };

  if (!currentUser) return <div>Verificando permissões...</div>;

  // ========== RENDER PRINCIPAL ==========
  return (
    <div className="admin-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Modal de edição de reserva */}
      {editandoReserva && (
        <div className="modal-overlay" onClick={() => setEditandoReserva(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Reserva</h3>
            <label>
              Título:
              <input
                type="text"
                value={editForm.titulo}
                onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
              />
            </label>
            <label>
              Data:
              <input
                type="date"
                value={editForm.data}
                onChange={(e) => setEditForm({ ...editForm, data: e.target.value })}
              />
            </label>
            <label>
              Início:
              <select
                value={editForm.hora_inicio}
                onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })}
              >
                {horarios.map((h) => <option key={h}>{h}</option>)}
              </select>
            </label>
            <label>
              Fim:
              <select
                value={editForm.hora_fim}
                onChange={(e) => setEditForm({ ...editForm, hora_fim: e.target.value })}
              >
                {horarios.filter((f) => {
                  const inicioMin =
                    parseInt(editForm.hora_inicio.split(':')[0]) * 60 + parseInt(editForm.hora_inicio.split(':')[1]);
                  const fimMin = parseInt(f.split(':')[0]) * 60 + parseInt(f.split(':')[1]);
                  return fimMin > inicioMin;
                }).map((h) => <option key={h}>{h}</option>)}
              </select>
            </label>
            <label>
              Descrição:
              <textarea
                value={editForm.descricao}
                onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                rows="2"
              />
            </label>
            <div className="modal-buttons">
              <button onClick={handleUpdateReserva}>Salvar</button>
              <button onClick={() => setEditandoReserva(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <header className="admin-header">
        <div className="header-content">
          <img src="/CBiot_logo.jpg" alt="Logo CBiot" className="logo" />
          <h1 className="central-title">Administração - Reserva de Salas CBiot</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span>
            {currentUser.nome} ({currentUser.cargo})
          </span>
          <Link to="/app" className="back-button">
            Voltar ao sistema
          </Link>
        </div>
      </header>

      {/* ========== 1. GERENCIAR SALAS ========== */}
      <section className="box">
        <h2>Gerenciar Salas</h2>
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
              <button onClick={handleCancelarEdicao} className="secondary">
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={handleAdicionarSala}>Adicionar sala</button>
          )}
        </div>

        <div className="salas-grid-mapa">
          {salas.map((sala) => (
            <div key={sala.id} className={`sala-card-mapa ${sala.em_manutencao ? 'manutencao' : ''}`}>
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
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="edit-sala-btn" onClick={() => handleEditarSala(sala)}>
                  Editar
                </button>
                <button className="delete-sala-btn" onClick={() => handleDeletarSala(sala.id, sala.nome)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========== 2. BLOQUEIOS DE MANUTENÇÃO ========== */}
      <section className="box">
        <h2>Bloqueios por Manutenção</h2>
        <div className="admin-sala-form">
          <select name="sala_id" value={novaManutencao.sala_id} onChange={handleChangeManutencao}>
            <option value="">Selecione a sala</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
          <input type="date" name="data_inicio" placeholder="Data início" value={novaManutencao.data_inicio} onChange={handleChangeManutencao} />
          <input type="date" name="data_fim" placeholder="Data fim" value={novaManutencao.data_fim} onChange={handleChangeManutencao} />
          <select name="hora_inicio" value={novaManutencao.hora_inicio} onChange={handleChangeManutencao}>
            {horarios.map((h) => <option key={h}>{h}</option>)}
          </select>
          <select name="hora_fim" value={novaManutencao.hora_fim} onChange={handleChangeManutencao}>
            {horarios.map((h) => <option key={h}>{h}</option>)}
          </select>
          <input name="motivo" placeholder="Motivo (ex.: reforma, manutenção elétrica)" value={novaManutencao.motivo} onChange={handleChangeManutencao} />
          <button onClick={handleCriarManutencao}>Bloquear período</button>
        </div>
        <div className="manutencoes-list">
          {manutencoes.map((m) => (
            <div key={m.id} className="manutencao-item">
              <div>
                <strong>{m.sala_nome}</strong> – {formatarData(m.data_inicio)} a {formatarData(m.data_fim)} das {m.hora_inicio} às {m.hora_fim}
                <br />
                <small>Motivo: {m.motivo}</small>
              </div>
              <button onClick={() => handleRemoverManutencao(m.id)}>Remover</button>
            </div>
          ))}
          {manutencoes.length === 0 && <p>Nenhum bloqueio ativo.</p>}
        </div>
      </section>

      {/* ========== 3. SOLICITAÇÕES DE RESERVA (layout igual Minhas Reservas) ========== */}
      <section className="box minhas-reservas-box">
        <div className="disponibilidade-header">
          <div>
            <h2>Solicitações de Reserva</h2>
            <p className="disponibilidade-sub">Aprove ou rejeite as solicitações pendentes.</p>
          </div>
        </div>

        <div className="modo-consulta" style={{ marginBottom: '1.5rem' }}>
          <label className={`modo-radio ${tabSolicitacoes === 'pendentes' ? 'active' : ''}`}>
            <input
              type="radio"
              name="tabSolicitacoes"
              value="pendentes"
              checked={tabSolicitacoes === 'pendentes'}
              onChange={() => setTabSolicitacoes('pendentes')}
            />
            <span>Pendentes ({solicitacoesPendentes.length})</span>
          </label>
          <label className={`modo-radio ${tabSolicitacoes === 'rejeitadas' ? 'active' : ''}`}>
            <input
              type="radio"
              name="tabSolicitacoes"
              value="rejeitadas"
              checked={tabSolicitacoes === 'rejeitadas'}
              onChange={() => setTabSolicitacoes('rejeitadas')}
            />
            <span>Rejeitadas ({solicitacoesRejeitadas.length})</span>
          </label>
        </div>

        <div className="reservas-lista">
          {tabSolicitacoes === 'pendentes' &&
            (solicitacoesPendentes.length === 0 ? (
              <p className="sem-reservas">Nenhuma solicitação pendente.</p>
            ) : (
              solicitacoesPendentes.map((s) => {
                const sala = salas.find((sl) => sl.id === s.sala_id);
                const [ano, mes, dia] = s.data.split('-');
                const dataObj = new Date(Date.UTC(ano, mes - 1, dia));
                const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
                const diaSemana = diasSemana[dataObj.getUTCDay()];
                const dataFormatada = `${dia}/${mes}/${ano}`;
                return (
                  <div className="reserva-card-minha" key={s.id}>
                    <div className="reserva-card-header">
                      <h3>{s.sala_nome}</h3>
                      <span className="reserva-status status-pendente">PENDENTE</span>
                    </div>
                    <div className="reserva-card-info">
                      <p>
                        <strong>{dataFormatada}</strong> · {diaSemana} · {s.hora_inicio} às {s.hora_fim}
                      </p>
                      {sala && (
                        <p className="sala-localizacao-card">
                          Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}
                        </p>
                      )}
                      <p className="reserva-titulo">{s.titulo}</p>
                      <p className="reserva-pendente-msg">
                        Solicitada por {s.responsavel} ({s.email}) · em {formatarData(s.data_criacao || s.data)}
                      </p>
                    </div>
                    <div className="reserva-actions-minhas">
                      <button className="edit-reserva-btn" onClick={() => handleAprovarSolicitacao(s.id)}>
                        Aprovar
                      </button>
                      <button className="cancel-reserva-btn" onClick={() => handleRejeitarSolicitacao(s.id)}>
                        Rejeitar
                      </button>
                    </div>
                  </div>
                );
              })
            ))}

          {tabSolicitacoes === 'rejeitadas' &&
            (solicitacoesRejeitadas.length === 0 ? (
              <p className="sem-reservas">Nenhuma reserva rejeitada.</p>
            ) : (
              solicitacoesRejeitadas.map((s) => {
                const sala = salas.find((sl) => sl.id === s.sala_id);
                const [ano, mes, dia] = s.data.split('-');
                const dataObj = new Date(Date.UTC(ano, mes - 1, dia));
                const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
                const diaSemana = diasSemana[dataObj.getUTCDay()];
                const dataFormatada = `${dia}/${mes}/${ano}`;
                return (
                  <div className="reserva-card-minha" key={s.id}>
                    <div className="reserva-card-header">
                      <h3>{s.sala_nome}</h3>
                      <span className="reserva-status status-cancelada">REJEITADA</span>
                    </div>
                    <div className="reserva-card-info">
                      <p>
                        <strong>{dataFormatada}</strong> · {diaSemana} · {s.hora_inicio} às {s.hora_fim}
                      </p>
                      {sala && (
                        <p className="sala-localizacao-card">
                          Bloco {sala.bloco || '?'} · {sala.andar || 'Andar não informado'}
                        </p>
                      )}
                      <p className="reserva-titulo">{s.titulo}</p>
                      <p className="reserva-rejeitada-msg">
                        Rejeitada por {s.aprovador} em {formatarDataHoraUTC(s.data_aprovacao)}
                      </p>
                    </div>
                    <div className="reserva-actions-minhas">
                      <button
                        className="detalhes-reserva-btn"
                        onClick={() =>
                          alert(
                            `Detalhes da reserva rejeitada:\nTítulo: ${s.titulo}\nSala: ${s.sala_nome}\nData: ${dataFormatada}\nHorário: ${s.hora_inicio} - ${s.hora_fim}`
                          )
                        }
                      >
                        Ver detalhes
                      </button>
                    </div>
                  </div>
                );
              })
            ))}
        </div>
      </section>

      {/* ========== 4. GERENCIAR USUÁRIOS (apenas admin) ========== */}
      {currentUser.cargo === 'admin' && (
        <section className="box">
          <h2>Gerenciar Usuários</h2>
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Cargo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.cargo} onChange={(e) => handleUpdateUser(u.id, { cargo: e.target.value })}>
                        <option value="aluno">Aluno</option>
                        <option value="professor">Professor</option>
                        <option value="gerente">Gerente</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>{u.status}</td>
                    <td>
                      {u.status === 'pendente' && (
                        <>
                          <button className="small-btn" onClick={() => handleApproveUser(u.id, u.cargo)}>
                            Aprovar
                          </button>
                          <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>
                            Rejeitar
                          </button>
                        </>
                      )}
                      {u.status === 'aprovado' && (
                        <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>
                          Bloquear
                        </button>
                      )}
                      {u.status === 'rejeitado' && (
                        <button className="small-btn" onClick={() => handleUpdateUser(u.id, { status: 'aprovado' })}>
                          Reativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p>Nenhum usuário cadastrado.</p>}
          </div>
        </section>
      )}

      {/* ========== 5. GERENCIAR RESERVAS (layout estilo Minhas Reservas) ========== */}
      <section className="box minhas-reservas-box">
        <div className="disponibilidade-header">
          <div>
            <h2>Gerenciar Reservas</h2>
            <p className="disponibilidade-sub">Todas as reservas futuras (aprovadas, pendentes e recorrentes).</p>
          </div>
        </div>
        <div className="reservas-lista">
          {reservas.length === 0 ? (
            <p className="sem-reservas">Nenhuma reserva encontrada.</p>
          ) : (
            reservas.map(renderReservaCard)
          )}
        </div>
      </section>

      <footer className="admin-footer">
        <Link to="/ReservaDeSalas" className="back-button">
          ← Voltar ao sistema
        </Link>
      </footer>
    </div>
  );
}

export default function Admin() {
  const [isAllowed, setIsAllowed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    whoami()
      .then((u) => {
        if (u && (u.cargo === 'admin' || u.cargo === 'gerente')) setIsAllowed(true);
        else navigate('/');
      })
      .catch(() => navigate('/'));
  }, []);

  return isAllowed ? <AdminPanel /> : null;
}