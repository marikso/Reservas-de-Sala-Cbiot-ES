import { useState } from 'react';
import { login, register, setToken } from './api';
import { useNavigate } from 'react-router-dom';
import cbiotLogo from './assets/CBiot_logo.jpg';

export default function LoginPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cargo: 'usuario_cbiot' });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    let res;
    if (modo === 'login') {
      res = await login(form.email, form.senha);
    } else {
      if (!form.nome.trim()) { setErro('Informe seu nome'); setLoading(false); return; }
      res = await register(form.nome, form.email, form.senha, form.cargo);
    }

    if (res.erro) {
      setErro(res.erro);
      setLoading(false);
    } else if (res.token) {
      setToken(res.token);
      navigate('/reserva-salas', { replace: true });
    }
  };

  const cargoOptions = [
    { value: 'usuario_cbiot', label: 'Aluno / Usuário' },
    { value: 'lider_de_grupo', label: 'Líder de Grupo (professor/técnico)' },
    { value: 'gerente', label: 'Gerente' },
    { value: 'admin', label: 'Administrador' },
  ];

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src={cbiotLogo} alt="CBiot" className="login-logo" />
          <h1>Reserva de Salas</h1>
          <p>Centro de Biotecnologia - UFRGS</p>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab ${modo === 'login' ? 'active' : ''}`}
            onClick={() => { setModo('login'); setErro(''); }}
          >
            Entrar
          </button>
          <button
            className={`login-tab ${modo === 'cadastro' ? 'active' : ''}`}
            onClick={() => { setModo('cadastro'); setErro(''); }}
          >
            Cadastrar
          </button>
        </div>

        {erro && <div className="login-erro">{erro}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {modo === 'cadastro' && (
            <div className="login-field">
              <label>Nome completo</label>
              <input
                type="text"
                name="nome"
                placeholder="Seu nome"
                value={form.nome}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              name="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="login-field">
            <label>Senha</label>
            <input
              type="password"
              name="senha"
              placeholder="Sua senha"
              value={form.senha}
              onChange={handleChange}
              required
              minLength={4}
            />
          </div>

          {modo === 'cadastro' && (
            <div className="login-field">
              <label>Cargo</label>
              <select name="cargo" value={form.cargo} onChange={handleChange}>
                {cargoOptions.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
