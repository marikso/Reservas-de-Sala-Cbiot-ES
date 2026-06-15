import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authLogin, setToken, PORTAL_AUTH_URL, whoami } from './api';

export default function Login() {
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (import.meta.env.VITE_DEV_MODE === 'true') {
      whoami().then(u => {
        if (u && u.email) navigate('/ReservaDeSalas', { replace: true });
      });
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authLogin({ email: form.email, senha: form.senha });
      if (data.erro || data.message && !data.token) {
        setError(data.erro || data.message || 'Credenciais inválidas');
        return;
      }
      const permissions = data.user?.permissions || [];
      if (!permissions.includes('ACCESS_RESERVA_SALAS')) {
        setError('Você não tem permissão para acessar o sistema de Reserva de Salas.');
        return;
      }
      setToken(data.token);
      navigate('/ReservaDeSalas', { replace: true });
    } catch {
      setError('Erro ao conectar com o servidor de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>Entrar no Sistema</h2>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          Use as credenciais do Portal UFRGS
        </p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleLogin} className="login-form">
          <label>
            E-mail
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>
            Senha
            <input name="senha" type="password" value={form.senha} onChange={handleChange} required />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
