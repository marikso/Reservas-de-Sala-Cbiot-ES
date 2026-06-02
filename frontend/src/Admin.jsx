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
  const [novaSala, setNovaSala] = useState('');
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdicionarSala = async () => {
    if (!novaSala.trim()) return;
    const res = await createSala(novaSala.trim());
    if (res.erro) {
      showToast(res.erro, 'error');
    } else {
      setNovaSala('');
      await loadSalas();
      showToast('Sala criada com sucesso!');
    }
  };

  const handleDeletarSala = async (id, nome) => {
    await deleteSala(id);
    await loadSalas();
    await loadReservas();
    showToast(`Sala "${nome}" excluída com sucesso!`);
  };

  const handleDeletarReserva = async (id, titulo) => {
    await deleteReserva(id);
    await loadReservas();
    showToast(`Reserva "${titulo}" cancelada com sucesso!`);
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
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <header className="admin-header">
        <div className="header-content">
          <img src="/CBiot_logo.jpg" alt="Logo CBiot" className="logo" />
          <h1 className="central-title">Administração - Reserva de Salas CBiot</h1>
        </div>
      </header>

      <section className="box">
        <h2>Gerenciar Salas</h2>
        <div className="admin-row">
          <input
            type="text"
            placeholder="Nome da nova sala"
            value={novaSala}
            onChange={(e) => setNovaSala(e.target.value)}
          />
          <button onClick={handleAdicionarSala}>Adicionar sala</button>
        </div>
        <div className="salas-grid">
          {salas.map((sala) => (
            <div className="sala-card" key={sala.id}>
              <span>{sala.nome}</span>
              <button onClick={() => handleDeletarSala(sala.id, sala.nome)}>Excluir</button>
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
                    style={{
                      marginLeft: '0.5rem',
                      background: '#e67e22',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      borderRadius: '20px'
                    }}
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