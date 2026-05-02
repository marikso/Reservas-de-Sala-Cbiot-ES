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

function AdminLogin({ onLogin }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await adminLogin(senha);
    if (res.erro) setErro(res.erro);
    else onLogin(true);
  };

  return (
    <div className="admin-login">
      <h2>Login Administrativo</h2>
      <form onSubmit={handleSubmit}>
        <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} />
        <button type="submit">Entrar</button>
        {erro && <p className="erro">{erro}</p>}
      </form>
    </div>
  );
}

function AdminPanel() {
  const [salas, setSalas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [novaSala, setNovaSala] = useState('');
  const [mensagem, setMensagem] = useState('');
  const navigate = useNavigate();

  const loadSalas = async () => { setSalas(await getSalas()); };
  const loadReservas = async () => { setReservas(await getReservas()); };

  useEffect(() => { loadSalas(); loadReservas(); }, []);

  const handleAdicionarSala = async () => {
    if (!novaSala.trim()) return;
    const res = await createSala(novaSala.trim());
    if (res.erro) setMensagem(res.erro);
    else { setNovaSala(''); await loadSalas(); setMensagem('✅ Sala criada'); }
  };

  const handleDeletarSala = async (id) => {
    await deleteSala(id);
    await loadSalas();
    await loadReservas();
  };

  const handleDeletarReserva = async (id) => {
    await deleteReserva(id);
    await loadReservas();
  };

  const handleLogout = async () => {
    await adminLogout();
    navigate('/admin');
  };

  return (
    <div className="admin-container">
      <header>
        <h1>Administração</h1>
        <div>
          <Link to="/">← Voltar</Link>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <section className="box">
        <h2>➕ Gerenciar Salas</h2>
        <div className="admin-row">
          <input type="text" placeholder="Nome da nova sala" value={novaSala} onChange={e => setNovaSala(e.target.value)} />
          <button onClick={handleAdicionarSala}>Adicionar sala</button>
        </div>
        <ul className="list">
          {salas.map(sala => (
            <li key={sala.id}>
              🪑 {sala.nome}
              <button onClick={() => handleDeletarSala(sala.id)}>Excluir</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="box">
        <h2>❌ Cancelar Reservas</h2>
        <div className="reservas-grid">
          {reservas.map(r => (
            <div className="reserva-card admin-card" key={r.id}>
              <h3>🏢 {r.sala_nome} · {r.titulo}</h3>
              <p><strong>📅 Data:</strong> {new Date(r.data).toLocaleDateString('pt-BR')}</p>
              <p><strong>⏰ Horário:</strong> {r.hora_inicio} – {r.hora_fim}</p>
              {r.responsavel && <p><strong>👤 Responsável:</strong> {r.responsavel}</p>}
              {r.email && <p><strong>📧 E-mail:</strong> {r.email}</p>}
              {r.descricao && <p><strong>📝 Descrição:</strong> {r.descricao}</p>}
              <button className="cancel-btn" onClick={() => handleDeletarReserva(r.id)}>Cancelar reserva</button>
            </div>
          ))}
        </div>
      </section>
      {mensagem && <div className="message">{mensagem}</div>}
    </div>
  );
}

export default function Admin() {
  const [autenticado, setAutenticado] = useState(false);
  return autenticado ? <AdminPanel /> : <AdminLogin onLogin={setAutenticado} />;
}