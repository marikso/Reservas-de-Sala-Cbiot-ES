import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getSalas,
  createSala,
  deleteSala,
  getReservas,
  deleteReserva,
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
  const [toast, setToast] = useState(null); // estado do popup
  const navigate = useNavigate();

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
      showToast('Sala criada com sucesso!', 'success');
    }
  };

  const handleDeletarSala = async (id, nome) => {
    await deleteSala(id);
    await loadSalas();
    await loadReservas();
    showToast(`Sala "${nome}" excluída com sucesso!`, 'success');
  };

  const handleDeletarReserva = async (id, titulo) => {
    await deleteReserva(id);
    await loadReservas();
    showToast(`Reserva "${titulo}" cancelada com sucesso!`, 'success');
  };

  const handleLogout = async () => {
    await adminLogout();
    navigate('/admin');
  };

  return (
    <div className="admin-container">
      {/* Toast notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Cabeçalho sem o link de voltar */}
      <header className="admin-header">
        <div className="header-content">
          <img src="/CBiot_logo.jpg" alt="Logo CBiot" className="logo" />
          <h1 className="central-title">Administração - Reserva de Salas CBiot</h1>
        </div>
      </header>

      {/* Gerenciar Salas */}
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

      {/* Cancelar Reservas */}
      <section className="box">
        <h2>Cancelar Reservas</h2>
        <div className="reservas-grid">
          {reservas.map((reserva) => (
            <div className="reserva-card" key={reserva.id}>
              <h3>{reserva.sala_nome} · {reserva.titulo}</h3>
              <p><strong>Data:</strong> {new Date(reserva.data).toLocaleDateString('pt-BR')}</p>
              <p><strong>Horário:</strong> {reserva.hora_inicio} – {reserva.hora_fim}</p>
              {reserva.responsavel && <p><strong>Responsável:</strong> {reserva.responsavel}</p>}
              {reserva.email && <p><strong>E-mail:</strong> {reserva.email}</p>}
              {reserva.descricao && <p><strong>Descrição:</strong> {reserva.descricao}</p>}
              <button className="cancel-btn" onClick={() => handleDeletarReserva(reserva.id, reserva.titulo)}>
                Cancelar reserva
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Rodapé com botão de voltar */}
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