import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getSalas,
  createSala,
  deleteSala,
  getReservas,
  deleteReserva,
  deleteReservasByGrupo,
  adminLogin,
  adminLogout,
} from './api';

// Componente de login
function AdminLogin({ onLogin }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await adminLogin(senha);
    if (res.erro) {
      setErro(res.erro);
    } else {
      onLogin(true);
    }
  };

  return (
    <div className="admin-login">
      <img src="/CBiot_logo.jpg" alt="CBiot" className="logo-small" />
      <h2>Login Painel Administrativo</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <button type="submit">Entrar</button>
        {erro && <p className="erro">{erro}</p>}
      </form>
      <Link to="/" className="back-link">← Voltar ao sistema</Link>
    </div>
  );
}

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
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const loadSalas = async () => {
    const data = await getSalas();
    // Ordenar salas numericamente/alfabeticamente
    const sorted = [...data].sort((a, b) =>
      a.nome.localeCompare(b.nome, undefined, { numeric: true })
    );
    setSalas(sorted);
  };
  const loadReservas = async () => {
    const data = await getReservas();
    setReservas(data);
  };

  useEffect(() => {
    loadSalas();
    loadReservas();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  const handleDeletarSala = async (id, nome) => {
    if (window.confirm(`Excluir a sala "${nome}"? Todas as reservas associadas também serão removidas.`)) {
      await deleteSala(id);
      await loadSalas();
      await loadReservas();
      showToast(`Sala "${nome}" excluída!`);
    }
  };

  const handleDeletarReserva = async (id, titulo) => {
    await deleteReserva(id);
    await loadReservas();
    showToast(`Reserva "${titulo}" cancelada!`);
  };

  const handleDeletarGrupo = async (grupoId) => {
    if (window.confirm('Cancelar TODAS as reservas deste grupo recorrente?')) {
      const res = await deleteReservasByGrupo(grupoId);
      if (res.erro) {
        showToast(res.erro, 'error');
      } else {
        await loadReservas();
        showToast(res.mensagem, 'success');
      }
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    navigate('/admin');
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

      <section className="box">
        <h2>Gerenciar Salas</h2>
        <div className="admin-sala-form">
          <input
            name="nome"
            placeholder="Nome da sala (obrigatório)"
            value={novaSala.nome}
            onChange={handleChangeSala}
          />
          <input
            name="bloco"
            placeholder="Bloco (ex: 43431)"
            value={novaSala.bloco}
            onChange={handleChangeSala}
          />
          <input
            name="andar"
            placeholder="Andar (ex: 2° andar)"
            value={novaSala.andar}
            onChange={handleChangeSala}
          />
          <input
            name="capacidade"
            placeholder="Capacidade (pessoas)"
            type="number"
            value={novaSala.capacidade}
            onChange={handleChangeSala}
          />
          <textarea
            name="equipamentos"
            placeholder="Equipamentos (separados por vírgula)"
            value={novaSala.equipamentos}
            onChange={handleChangeSala}
            rows="2"
          />
          <button onClick={handleAdicionarSala}>Adicionar sala</button>
        </div>

        {/* Mapa de salas no admin (mesmo estilo do público) */}
        <div className="salas-grid-mapa">
          {salas.map((sala) => (
            <div key={sala.id} className="sala-card-mapa">
              <div className="sala-nome">{sala.nome}</div>
              <div className="sala-localizacao">
                📍 Bloco {sala.bloco || '?'} | Andar {sala.andar || '?'}
              </div>
              <div className="sala-info">
                <span>👥 Capacidade: {sala.capacidade || '?'} pessoas</span>
              </div>
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
              <button
                className="delete-sala-btn"
                onClick={() => handleDeletarSala(sala.id, sala.nome)}
              >
                Excluir sala
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="box">
        <h2>Cancelar Reservas</h2>
        <div className="reservas-grid">
          {reservas.map((r) => (
            <div className="reserva-card admin-card" key={r.id}>
              <h3>{r.sala_nome} · {r.titulo}</h3>
              {r.grupo_id && (
                <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                  Grupo: {r.grupo_id.substring(0, 8)}...
                  <button
                    className="cancel-group-btn"
                    onClick={() => handleDeletarGrupo(r.grupo_id)}
                  >
                    Cancelar todas
                  </button>
                </p>
              )}
              <p><strong>Data:</strong> {formatarData(r.data)}</p>
              <p><strong>Horário:</strong> {r.hora_inicio} – {r.hora_fim}</p>
              {r.responsavel && <p><strong>Responsável:</strong> {r.responsavel}</p>}
              {r.email && <p><strong>E-mail:</strong> {r.email}</p>}
              {r.descricao && <p><strong>Descrição:</strong> {r.descricao}</p>}
              <button className="cancel-btn" onClick={() => handleDeletarReserva(r.id, r.titulo)}>
                Cancelar reserva
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="admin-footer">
        <Link to="/" className="back-button">← Voltar ao público</Link>
      </footer>
    </div>
  );
}

export default function Admin() {
  const [autenticado, setAutenticado] = useState(false);
  return autenticado ? <AdminPanel /> : <AdminLogin onLogin={setAutenticado} />;
}