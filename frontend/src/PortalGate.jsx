import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken, getToken, redirectToPortalLogin } from './api';

// Ponto de entrada da aplicação. O login é feito inteiramente pelo Portal
// centralizado: ele autentica o usuário e o redireciona de volta para o
// ReservaSala com "?token=<token>" na URL. Este componente captura esse
// token, ou usa um já salvo, e só então libera o acesso ao app; caso não
// haja token nenhum, manda o usuário para a tela de login do Portal.
export default function PortalGate() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      setToken(token);
      navigate('/ReservaDeSalas', { replace: true });
      return;
    }

    if (getToken()) {
      navigate('/ReservaDeSalas', { replace: true });
      return;
    }

    redirectToPortalLogin();
  }, []);

  return <div>Redirecionando para o Portal...</div>;
}
