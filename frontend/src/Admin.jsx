import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getSalas,
  createSala,
  updateSala,
  deleteSala,
  getReservas,
  deleteReserva,
  deleteReservasByGrupo,
  whoami,
} from './api';

// Função para gerar horários de 30 em 30 minutos (08:00 às 19:00)
const generateTimeOptions = () => {
  const times = [];
  for (let i = 8; i < 19; i++) {
    times.push(`${String(i).padStart(2, '0')}:00`);
    if (i < 18) times.push(`${String(i).padStart(2, '0')}:30`);
  }
  return times;
};

// Componente de login
// Admin access is controlled by user role (cargo === 'admin') via whoami(), no password required.

// Componente do painel (após login)
function AdminPanel() {
  const [salas, setSalas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [novaSala, setNovaSala] = useState({
    nome: '',
    bloco: '',
    andar: '',
    capacidade: '',
    equipamentos: '',
  });
  const [editandoSala, setEditandoSala] = useState(null);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  // Estados para manutenções
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

  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  // Carregar salas e reservas
  const loadSalas = async () => {
    const data = await getSalas();
    const sorted = [...data].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));
    setSalas(sorted);
  };
  const loadReservas = async () => {
    const data = await getReservas();
    setReservas(data);
  };

  // Carregar manutenções
  const loadManutencoes = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/manutencoes', {
        credentials: 'include',
      });
      const data = await res.json();
      setManutencoes(data);
    } catch (err) {
      console.error('Erro ao carregar manutenções', err);
    }
  };

  useEffect(() => {
    loadSalas();
    loadReservas();
    loadManutencoes();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------- CRUD de Salas ----------
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
    if (res.erro) {
      showToast(res.erro, 'error');
    } else {
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
    if (res.erro) {
      showToast(res.erro, 'error');
    } else {
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

  // ---------- Cancelamento de Reservas ----------
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

  // ---------- Gerenciamento de Manutenções ----------
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
      if (!res.ok) {
        showToast(data.erro || 'Erro ao criar bloqueio', 'error');
      } else {
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
        loadSalas(); // para atualizar a badge de manutenção
      }
    } catch (err) {
      showToast('Erro de conexão', 'error');
    }
  };

  const handleRemoverManutencao = async (id) => {
    if (window.confirm('Remover este bloqueio de manutenção?')) {
      try {
        const res = await fetch(`http://localhost:5000/api/manutencoes/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
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

  return (
    <div className="admin-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <header className="admin-header">
        <div className="header-content">
          <img src="/CBiot_logo.jpg" alt="Logo CBiot" className="logo" />
          <h1 className="central-title">Administração - Reserva de Salas CBiot</h1>
        </div>
      </header>

      {/* Gerenciar Salas */}
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
              <button onClick={handleCancelarEdicao} className="secondary">Cancelar</button>
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

      {/* Bloqueios de Manutenção */}
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
            {horarios.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
          <select name="hora_fim" value={novaManutencao.hora_fim} onChange={handleChangeManutencao}>
            {horarios.map((h) => (
              <option key={h}>{h}</option>
            ))}
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

      {/* Cancelar Reservas */}
      <section className="box">
        <h2>Cancelar Reservas</h2>
        <div className="reservas-grid">
          {reservas.map((r) => (
            <div className="reserva-card admin-card" key={r.id}>
              <h3>{r.sala_nome} · {r.titulo}</h3>
              {r.grupo_id && (
                <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                  Grupo: {r.grupo_id.substring(0, 8)}...
                  <button className="cancel-group-btn" onClick={() => handleDeletarGrupo(r.grupo_id)}>Cancelar todas</button>
                </p>
              )}
              <p><strong>Data:</strong> {formatarData(r.data)}</p>
              <p><strong>Horário:</strong> {r.hora_inicio} – {r.hora_fim}</p>
              {r.responsavel && <p><strong>Responsável:</strong> {r.responsavel}</p>}
              {r.email && <p><strong>E-mail:</strong> {r.email}</p>}
              {r.descricao && <p><strong>Descrição:</strong> {r.descricao}</p>}
              <button className="cancel-btn" onClick={() => handleDeletarReserva(r.id, r.titulo)}>Cancelar reserva</button>
            </div>
          ))}
        </div>
      </section>

      <footer className="admin-footer">
        <Link to="/app" className="back-button">← Voltar ao sistema</Link>
      </footer>
    </div>
  );
}

export default function Admin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    whoami().then((u) => {
      if (u && u.cargo === 'admin') setIsAdmin(true);
      else navigate('/');
    }).catch(() => navigate('/'));
  }, []);

  return isAdmin ? <AdminPanel /> : null;
}