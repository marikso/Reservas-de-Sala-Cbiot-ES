import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authLogin, authRegister } from './api';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [form, setForm] = useState({ email: '', nome: '', senha: '' });
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    const res = await authLogin({ email: form.email, senha: form.senha });
    if (res && res.erro) {
      setError(res.erro);
            return;
        }
        navigate('/app', { replace: true });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);
        const res = await authRegister({ nome: form.nome, email: form.email, senha: form.senha });
        if (res && res.erro) {
            setError(res.erro);
            return;
        }
        // Mostra mensagem e volta para login
        alert('Cadastro realizado! Aguarde a aprovação do administrador.');
        setMode('login');
        setForm({ email: '', nome: '', senha: '' });
    };

    return (
    <div className="login-page">
      <div className="login-box">
        <h2>{mode === 'login' ? 'Entrar no Sistema' : 'Cadastro de Usuário'}</h2>
        {error && <div className="error">{error}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="login-form">
            <label>
              E-mail
              <input name="email" type="email" value={form.email} onChange={handleChange} required />
            </label>
            <label>
              Senha
              <input name="senha" type="password" value={form.senha} onChange={handleChange} required />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit">Entrar</button>
              <button type="button" onClick={() => { setMode('register'); setError(null); }}>Criar conta</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="login-form">
            <label>
              Nome
              <input name="nome" value={form.nome} onChange={handleChange} required />
            </label>
            <label>
              E-mail
              <input name="email" type="email" value={form.email} onChange={handleChange} required />
            </label>
            <label>
              Senha
              <input name="senha" type="password" value={form.senha} onChange={handleChange} required />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit">Cadastrar</button>
              <button type="button" onClick={() => { setMode('login'); setError(null); }}>Voltar ao login</button>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>Seu cargo será definido como <strong>aluno</strong>.</p>
          </form>
        )}
      </div>
    </div>
  );
}
