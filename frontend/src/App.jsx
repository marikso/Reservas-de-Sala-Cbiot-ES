import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getSalas,
  getReservas,
  createReserva,
  createReservaRecorrente,
  getDisponibilidade,
  deleteReserva,
  deleteReservasByGrupo,
  whoami,
  authLogout,
  getUsers,
  createSala,
  updateSala,
  deleteSala,
  updateUser,
  approveUser,
} from './api';

// ========== FUNÇÕES AUXILIARES DE HORÁRIO (30 minutos) ==========
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};
const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const add30min = (timeStr) => minutesToTime(timeToMinutes(timeStr) + 30);

const generateAllStartTimes = () => {
  const times = [];
  let mins = 8 * 60;
  while (mins < 19 * 60) {
    times.push(minutesToTime(mins));
    mins += 30;
  }
  return times;
};
const generateAllEndTimes = () => {
  const times = [];
  let mins = 8 * 60 + 30;
  while (mins <= 19 * 60) {
    times.push(minutesToTime(mins));
    mins += 30;
  }
  return times;
};

function App() {
  // ========== ESTADOS ==========
  const [salas, setSalas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [disponibilidade, setDisponibilidade] = useState(null);
  const [form, setForm] = useState({
    sala_id: '',
    titulo: '',
    data: '',
    hora_inicio: '08:00',
    hora_fim: '08:30',
    responsavel: '',
    email: '',
    descricao: '',
  });
  const [toast, setToast] = useState(null);
  const [reservasDoDia, setReservasDoDia] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('inicio');
  const [users, setUsers] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [novaSala, setNovaSala] = useState({ nome: '', bloco: '', andar: '', capacidade: '', equipamentos: '' });
  const [editandoSala, setEditandoSala] = useState(null);
  const [novaManutencao, setNovaManutencao] = useState({ sala_id: '', data_inicio: '', data_fim: '', hora_inicio: '08:00', hora_fim: '09:00', motivo: '' });
  const navigate = useNavigate();
  const [recorrente, setRecorrente] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [dataFim, setDataFim] = useState('');

  // Estados para consulta de disponibilidade
  const [modoDisponibilidade, setModoDisponibilidade] = useState('sala');
  const [disponibilidadeDataHora, setDisponibilidadeDataHora] = useState(null);
  const [dataConsulta, setDataConsulta] = useState('');
  const [horaConsulta, setHoraConsulta] = useState('08:00');
  const [horaFimConsulta, setHoraFimConsulta] = useState('08:30');

  const dataSelecionada = !!form.data;

  // ========== CARREGAMENTO INICIAL ==========
  const loadSalas = async () => {
    const data = await getSalas();
    setSalas(data);
  };
  const loadReservas = async () => {
    const data = await getReservas();
    setReservas(data);
  };
  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Erro ao carregar usuários', err);
    }
  };
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
    whoami()
      .then((u) => {
        if (u && u.email) {
          setCurrentUser(u);
          // Preenche responsável e e-mail com os dados do usuário
          setForm((prev) => ({
            ...prev,
            responsavel: u.nome || '',
            email: u.email,
          }));
          if (['admin', 'gerente'].includes(u.cargo)) {
            loadUsers();
            loadManutencoes();
          }
        }
      })
      .catch(() => {});
  }, []);

  // ========== AUXILIARES ==========
  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const minhasReservas = useMemo(() => {
    if (!currentUser) return [];
    return reservas.filter((r) => r.email === currentUser.email && r.data >= hoje);
  }, [reservas, currentUser, hoje]);
  const reservasAtivas = useMemo(() => reservas.filter((r) => r.data >= hoje), [reservas, hoje]);
  const userCanAdmin = currentUser && ['admin', 'gerente'].includes(currentUser.cargo);
  const userIsAdmin = currentUser && currentUser.cargo === 'admin';

  // ========== LÓGICA DE HORÁRIOS DISPONÍVEIS (formulário) ==========
  const reservasIntervalos = useMemo(() => {
    return reservasDoDia.map((r) => ({
      inicio: timeToMinutes(r.hora_inicio),
      fim: timeToMinutes(r.hora_fim),
    }));
  }, [reservasDoDia]);

  const conflita = (inicio, fim) => {
    return reservasIntervalos.some((r) => inicio < r.fim && fim > r.inicio);
  };

  const todosInicios = useMemo(() => generateAllStartTimes(), []);
  const todosFins = useMemo(() => generateAllEndTimes(), []);

  const horasInicioDisponiveis = useMemo(() => {
    if (!dataSelecionada && !recorrente) return [];
    if (recorrente) return todosInicios;
    return todosInicios.filter((inicio) => {
      const fim = add30min(inicio);
      return !conflita(timeToMinutes(inicio), timeToMinutes(fim));
    });
  }, [todosInicios, dataSelecionada, recorrente, reservasIntervalos]);

  const horasFimDisponiveis = useMemo(() => {
    if (!form.hora_inicio) return [];
    const inicioMin = timeToMinutes(form.hora_inicio);
    if (recorrente) {
      return todosFins.filter((fimStr) => timeToMinutes(fimStr) > inicioMin);
    }
    const proximosInicios = reservasIntervalos
      .map((r) => r.inicio)
      .filter((min) => min > inicioMin)
      .sort((a, b) => a - b);
    const limite = proximosInicios.length ? proximosInicios[0] : 19 * 60;
    return todosFins.filter((fimStr) => {
      const fimMin = timeToMinutes(fimStr);
      return fimMin > inicioMin && fimMin <= limite;
    });
  }, [form.hora_inicio, todosFins, recorrente, reservasIntervalos]);

  useEffect(() => {
    if (horasFimDisponiveis.length && !horasFimDisponiveis.includes(form.hora_fim)) {
      setForm((prev) => ({ ...prev, hora_fim: horasFimDisponiveis[0] }));
    }
  }, [horasFimDisponiveis, form.hora_fim]);

  useEffect(() => {
    if (!recorrente && dataSelecionada && horasInicioDisponiveis.length) {
      if (!horasInicioDisponiveis.includes(form.hora_inicio)) {
        setForm((prev) => ({ ...prev, hora_inicio: horasInicioDisponiveis[0] }));
      }
    }
  }, [horasInicioDisponiveis, form.hora_inicio, dataSelecionada, recorrente]);

  // ========== MANIPULAÇÃO DE RESERVAS ==========
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Campos responsavel e email são apenas leitura, então não permitimos alteração
    if (name === 'responsavel' || name === 'email') return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    await authLogout();
    setCurrentUser(null);
    showToast('Desconectado', 'info');
    navigate('/');
  };

  const handleChangeSala = (e) => {
    const { name, value } = e.target;
    setNovaSala((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSala = async () => {
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

  const handleDeleteReserva = async (id) => {
    await deleteReserva(id);
    await loadReservas();
    showToast('Reserva cancelada com sucesso', 'success');
  };

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
        setNovaManutencao({ sala_id: '', data_inicio: '', data_fim: '', hora_inicio: '08:00', hora_fim: '09:00', motivo: '' });
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

  const handleUpdateUser = async (userId, data) => {
    const res = await updateUser(userId, data);
    if (res.erro) {
      showToast(res.erro, 'error');
    } else {
      showToast('Usuário atualizado', 'success');
      loadUsers();
    }
  };

  const handleApproveUser = async (userId, cargo) => {
    const res = await approveUser(userId, cargo);
    if (res.erro) {
      showToast(res.erro, 'error');
    } else {
      showToast('Usuário aprovado', 'success');
      loadUsers();
    }
  };

  const handleSubmitReserva = async (e) => {
    e.preventDefault();
    if (!form.sala_id) {
      showToast('Escolha uma sala antes de reservar', 'error');
      return;
    }
    if (!recorrente && !form.data) {
      showToast('Selecione uma data', 'error');
      return;
    }
    if (recorrente && (!dataFim || diasSelecionados.length === 0)) {
      showToast('Informe a data final e pelo menos um dia da semana', 'error');
      return;
    }

    let response;
    if (recorrente) {
      const payload = {
        sala_id: form.sala_id,
        titulo: form.titulo,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        dias_semana: diasSelecionados,
        data_inicio: form.data,
        data_fim: dataFim,
        responsavel: form.responsavel,
        email: form.email,
        descricao: form.descricao,
      };
      response = await createReservaRecorrente(payload);
    } else {
      response = await createReserva(form);
    }

    if (response.erro) {
      showToast(response.erro, 'error');
      return;
    }

    if (recorrente) {
      if (response.conflitos && response.conflitos.length > 0) {
        const conflitosStr = response.conflitos.join(', ');
        const userConfirmed = window.confirm(
          `Existem conflitos nas seguintes datas: ${conflitosStr}\n\nDeseja criar as reservas apenas para as datas disponíveis?`
        );
        if (!userConfirmed) {
          if (response.grupo_id) {
            await deleteReservasByGrupo(response.grupo_id);
            showToast('Operação cancelada.', 'info');
          } else {
            showToast('Nenhuma reserva foi criada.', 'error');
          }
          await loadReservas();
          return;
        } else {
          showToast(`${response.reservas_criadas.length} reservas criadas.`, 'success');
        }
      } else {
        showToast(response.mensagem, 'success');
      }
      await loadReservas();
      setForm((prev) => ({ ...prev, titulo: '', responsavel: currentUser?.nome || '', email: currentUser?.email || '', descricao: '' }));
      setDataFim('');
      setDiasSelecionados([]);
      setRecorrente(false);
    } else {
      showToast('Reserva criada com sucesso!', 'success');
      setForm((prev) => ({ ...prev, titulo: '', descricao: '' })); // mantém responsavel/email do usuário
      await loadReservas();
    }
  };

  // ========== DISPONIBILIDADE (modo sala/data) ==========
  const handleDisponibilidade = async () => {
    if (!form.sala_id || !form.data) {
      showToast('Escolha sala e data para ver disponibilidade', 'error');
      return;
    }
    const response = await getDisponibilidade(form.sala_id, form.data);
    if (response.erro) {
      showToast(response.erro, 'error');
      return;
    }
    setDisponibilidade(response);
  };

  useEffect(() => {
    if (!form.sala_id || !form.data) {
      setReservasDoDia([]);
      return;
    }
    getDisponibilidade(form.sala_id, form.data).then((response) => {
      if (response?.horarios) {
        setReservasDoDia(response.horarios.filter((h) => h.ocupado));
      }
    });
  }, [form.sala_id, form.data]);

  // ========== CONSULTA POR DATA/HORA (intervalo) ==========
  const handleConsultarDisponibilidadeDataHora = async () => {
    if (!dataConsulta || !horaConsulta || !horaFimConsulta) {
      showToast('Selecione data, início e fim', 'error');
      return;
    }
    const res = await fetch(`http://localhost:5000/api/salas/disponiveis?data=${dataConsulta}&hora_inicio=${horaConsulta}&hora_fim=${horaFimConsulta}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      setDisponibilidadeDataHora(data);
    } else {
      showToast(data.erro || 'Erro na consulta', 'error');
    }
  };

  // ========== ORDENAÇÃO DAS SALAS PARA MAPA ==========
  const salasOrdenadas = useMemo(() => {
    return [...salas].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));
  }, [salas]);

  // ========== RENDER ==========
  const selectsDisabled = !dataSelecionada && !recorrente;
  const camposTextDisabled = !dataSelecionada && !recorrente;

  const pageTitle = {
    inicio: 'Inicio',
    consultar: 'Consultar disponibilidade',
    'minhas-reservas': 'Minhas reservas',
    'meus-dados': 'Meus Dados',
    solicitacoes: 'Solicitações',
    reservas: 'Reservas',
    salas: 'Salas',
    usuarios: 'Usuários',
  }[activeTab] || 'Início';

  const renderPageContent = () => {
    switch (activeTab) {
      case 'consultar':
        return (
          <>
            <section className="box mapa-salas">
              <h2>🗺️ Mapa das Salas</h2>
              <div className="salas-grid-mapa">
                {salasOrdenadas.map((sala) => (
                  <div
                    key={sala.id}
                    className={`sala-card-mapa ${form.sala_id == sala.id ? 'selecionada' : ''} ${sala.em_manutencao ? 'manutencao' : ''}`}
                    onClick={() => setForm((prev) => ({ ...prev, sala_id: sala.id }))}
                  >
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
                  </div>
                ))}
              </div>
            </section>
            <section className="box">
              <h2>🔍 Consultar disponibilidade</h2>
              <div className="modo-consulta">
                <label>
                  <input type="radio" value="sala" checked={modoDisponibilidade === 'sala'} onChange={() => setModoDisponibilidade('sala')} />
                  Por sala e data
                </label>
                <label>
                  <input type="radio" value="data_hora" checked={modoDisponibilidade === 'data_hora'} onChange={() => setModoDisponibilidade('data_hora')} />
                  Por data e hora (intervalo)
                </label>
              </div>

              {modoDisponibilidade === 'sala' ? (
                <div className="consulta-sala">
                  <label>
                    Sala:
                    <select value={form.sala_id} onChange={(e) => setForm((prev) => ({ ...prev, sala_id: e.target.value }))}>
                      <option value="">Selecione</option>
                      {salas.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Data:
                    <input type="date" value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} />
                  </label>
                  <button onClick={handleDisponibilidade}>Ver disponibilidade</button>
                </div>
              ) : (
                <div className="consulta-data-hora">
                  <label>
                    Data:
                    <input type="date" value={dataConsulta} onChange={(e) => setDataConsulta(e.target.value)} />
                  </label>
                  <label>
                    Início:
                    <select value={horaConsulta} onChange={(e) => setHoraConsulta(e.target.value)}>
                      {todosInicios.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fim:
                    <select value={horaFimConsulta} onChange={(e) => setHoraFimConsulta(e.target.value)}>
                      {todosFins.filter(f => timeToMinutes(f) > timeToMinutes(horaConsulta)).map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                  <button onClick={handleConsultarDisponibilidadeDataHora}>Buscar salas disponíveis</button>
                </div>
              )}

              {modoDisponibilidade === 'sala' && disponibilidade && (
                <div className="resultado-disponibilidade">
                  <h3>Horários disponíveis - {disponibilidade.sala_nome} ({formatarData(disponibilidade.data)})</h3>
                  <ul className="grid-list">
                    {disponibilidade.horarios.map((item) => (
                      <li
                        key={`${item.hora_inicio}-${item.hora_fim}`}
                        className={item.ocupado ? item.titulo && item.titulo.startsWith('Manutenção') ? 'manutencao' : 'ocupado' : 'livre'}
                        onClick={() => {
                          if (!item.ocupado) {
                            setForm((prev) => ({
                              ...prev,
                              sala_id: form.sala_id,
                              data: form.data,
                              hora_inicio: item.hora_inicio,
                              hora_fim: item.hora_fim,
                            }));
                            document.getElementById('form-reserva')?.scrollIntoView({ behavior: 'smooth' });
                            showToast(`Horário ${item.hora_inicio} - ${item.hora_fim} selecionado`, 'info');
                          }
                        }}
                        style={item.ocupado ? {} : { cursor: 'pointer' }}
                      >
                        <strong>{item.hora_inicio}</strong> - {item.hora_fim}
                        <strong>{item.ocupado ? item.titulo : ' Livre'}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {modoDisponibilidade === 'data_hora' && disponibilidadeDataHora && (
                <div className="resultado-disponibilidade">
                  <h3>Salas disponíveis em {formatarData(dataConsulta)} das {horaConsulta} às {horaFimConsulta}</h3>
                  {disponibilidadeDataHora.length === 0 ? (
                    <p>Nenhuma sala disponível nesse horário.</p>
                  ) : (
                    <div className="salas-disponiveis-grid">
                      {disponibilidadeDataHora.map((sala) => (
                        <div
                          key={sala.id}
                          className="sala-card-mapa"
                          onClick={() => {
                            setForm({
                              sala_id: sala.id,
                              titulo: form.titulo,
                              data: dataConsulta,
                              hora_inicio: horaConsulta,
                              hora_fim: horaFimConsulta,
                              responsavel: form.responsavel,
                              email: form.email,
                              descricao: form.descricao,
                            });
                            setModoDisponibilidade('sala');
                            document.getElementById('form-reserva')?.scrollIntoView({ behavior: 'smooth' });
                            showToast('Formulário preenchido com a sala e horário selecionados', 'info');
                          }}
                        >
                          <div className="sala-nome">{sala.nome}</div>
                          <div className="sala-localizacao">📍 Bloco {sala.bloco || '?'} | {sala.andar || '?'}</div>
                          <div className="sala-info">👥 Capacidade: {sala.capacidade || '?'}</div>
                          {sala.equipamentos && (
                            <div className="sala-equipamentos">📋 {sala.equipamentos.substring(0, 50)}...</div>
                          )}
                          <button className="small-btn">Selecionar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        );
      case 'minhas-reservas':
        return (
          <section className="box">
            <h2>📋 Minhas reservas</h2>
            <div className="reservas-grid">
              {minhasReservas.length === 0 ? (
                <p>Você não possui reservas futuras.</p>
              ) : (
                minhasReservas.map((reserva) => {
                  const sala = salas.find((s) => s.id === reserva.sala_id);
                  return (
                    <div className="reserva-card" key={reserva.id}>
                      <h3>{reserva.sala_nome}</h3>
                      <p><strong>Título:</strong> {reserva.titulo}</p>
                      {reserva.grupo_id && <p><strong>Grupo:</strong> {reserva.grupo_id.substring(0, 8)}...</p>}
                      <p><strong>Data:</strong> {formatarData(reserva.data)}</p>
                      <p><strong>Horário:</strong> {reserva.hora_inicio} - {reserva.hora_fim}</p>
                      {sala && <p><strong>Localização:</strong> Bloco {sala.bloco || '?'} | {sala.andar || 'Andar não informado'}</p>}
                      <p><strong>Responsável:</strong> {reserva.responsavel}</p>
                      <p><strong>E-mail:</strong> {reserva.email}</p>
                      {reserva.descricao && <p><strong>Descrição:</strong> {reserva.descricao}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        );
      case 'meus-dados':
        return (
          <section className="box user-card-box">
            <h2>👤 Meus Dados</h2>
            {currentUser ? (
              <div className="user-card">
                <div>
                  <p><strong>Nome:</strong> {currentUser.nome}</p>
                  <p><strong>E-mail:</strong> {currentUser.email}</p>
                  <p><strong>Cargo:</strong> {currentUser.cargo}</p>
                </div>
              </div>
            ) : (
              <p>Carregando usuário...</p>
            )}
          </section>
        );
      case 'solicitacoes':
        return (
          <section className="box">
            <h2>📝 Solicitações</h2>
            {users.filter((u) => u.status === 'pendente').length === 0 ? (
              <p>Não há solicitações pendentes.</p>
            ) : (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Cargo</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter((u) => u.status === 'pendente').map((u) => (
                      <tr key={u.id}>
                        <td>{u.nome}</td>
                        <td>{u.email}</td>
                        <td>{u.cargo}</td>
                        <td>
                          <button className="small-btn" onClick={() => handleApproveUser(u.id, u.cargo)}>Aprovar</button>
                          <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Rejeitar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      case 'reservas':
        return (
          <section className="box">
            <h2>📋 Reservas</h2>
            <div className="reservas-grid">
              {reservasAtivas.length === 0 ? (
                <p>Não há reservas ativas.</p>
              ) : (
                reservasAtivas.map((reserva) => {
                  const sala = salas.find((s) => s.id === reserva.sala_id);
                  return (
                    <div className="reserva-card admin-card" key={reserva.id}>
                      <h3>{reserva.sala_nome} · {reserva.titulo}</h3>
                      {reserva.grupo_id && (
                        <p className="small-note">Grupo: {reserva.grupo_id.substring(0, 8)}...</p>
                      )}
                      <p><strong>Data:</strong> {formatarData(reserva.data)}</p>
                      <p><strong>Horário:</strong> {reserva.hora_inicio} - {reserva.hora_fim}</p>
                      {sala && <p><strong>Localização:</strong> Bloco {sala.bloco || '?'} | {sala.andar || 'Andar não informado'}</p>}
                      {reserva.responsavel && <p><strong>Responsável:</strong> {reserva.responsavel}</p>}
                      {reserva.email && <p><strong>E-mail:</strong> {reserva.email}</p>}
                      {reserva.descricao && <p><strong>Descrição:</strong> {reserva.descricao}</p>}
                      <button className="cancel-btn" onClick={async () => {
                        await handleDeleteReserva(reserva.id);
                      }}>Cancelar reserva</button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        );
      case 'salas':
        return (
          <>
            <section className="box">
              <h2>🏢 Gerenciar Salas</h2>
              <div className="admin-sala-form">
                <input name="nome" placeholder="Nome da sala (obrigatório)" value={novaSala.nome} onChange={handleChangeSala} />
                <input name="bloco" placeholder="Bloco (ex: 43431)" value={novaSala.bloco} onChange={handleChangeSala} />
                <input name="andar" placeholder="Andar (ex: 2° andar)" value={novaSala.andar} onChange={handleChangeSala} />
                <input name="capacidade" placeholder="Capacidade (pessoas)" type="number" value={novaSala.capacidade} onChange={handleChangeSala} />
                <textarea name="equipamentos" placeholder="Equipamentos (separados por vírgula)" value={novaSala.equipamentos} onChange={handleChangeSala} rows="2" />
                {editandoSala ? (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleUpdateSala}>Salvar alterações</button>
                    <button onClick={handleCancelarEdicao} className="secondary">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={handleAddSala}>Adicionar sala</button>
                )}
              </div>
            </section>

            <section className="box mapa-salas">
              <h2>Salas Cadastradas</h2>
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

            <section className="box">
              <h2>🔧 Bloqueios por Manutenção</h2>
              <div className="admin-sala-form">
                <select name="sala_id" value={novaManutencao.sala_id} onChange={handleChangeManutencao}>
                  <option value="">Selecione a sala</option>
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
                <input type="date" name="data_inicio" value={novaManutencao.data_inicio} onChange={handleChangeManutencao} />
                <input type="date" name="data_fim" value={novaManutencao.data_fim} onChange={handleChangeManutencao} />
                <select name="hora_inicio" value={novaManutencao.hora_inicio} onChange={handleChangeManutencao}>
                  {todosInicios.map((h) => <option key={h}>{h}</option>)}
                </select>
                <select name="hora_fim" value={novaManutencao.hora_fim} onChange={handleChangeManutencao}>
                  {todosInicios.map((h) => <option key={h}>{h}</option>)}
                </select>
                <input name="motivo" placeholder="Motivo" value={novaManutencao.motivo} onChange={handleChangeManutencao} />
                <button onClick={handleCriarManutencao}>Bloquear período</button>
              </div>
              <div className="manutencoes-list">
                {manutencoes.length === 0 ? <p>Nenhum bloqueio ativo.</p> : manutencoes.map((m) => (
                  <div key={m.id} className="manutencao-item">
                    <div>
                      <strong>{m.sala_nome}</strong> – {formatarData(m.data_inicio)} a {formatarData(m.data_fim)} das {m.hora_inicio} às {m.hora_fim}
                      <br />
                      <small>Motivo: {m.motivo}</small>
                    </div>
                    <button onClick={() => handleRemoverManutencao(m.id)}>Remover</button>
                  </div>
                ))}
              </div>
            </section>
          </>
        );
      case 'usuarios':
        return (
          <section className="box">
            <h2>👥 Gerenciar Usuários</h2>
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
                        <select
                          value={u.cargo}
                          onChange={(e) => handleUpdateUser(u.id, { cargo: e.target.value })}
                        >
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
                            <button className="small-btn" onClick={() => handleApproveUser(u.id, u.cargo)}>Aprovar</button>
                            <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Rejeitar</button>
                          </>
                        )}
                        {u.status === 'aprovado' && (
                          <button className="small-btn danger" onClick={() => handleUpdateUser(u.id, { status: 'rejeitado' })}>Bloquear</button>
                        )}
                        {u.status === 'rejeitado' && (
                          <button className="small-btn" onClick={() => handleUpdateUser(u.id, { status: 'aprovado' })}>Reativar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p>Nenhum usuário cadastrado.</p>}
            </div>
          </section>
        );
      default:
        return (
          <>
            <section className="box">
              <h2>📝 Fazer reserva</h2>
              <form onSubmit={handleSubmitReserva} className="form-grid">
                <label>
                  Sala *
                  <select name="sala_id" value={form.sala_id} onChange={handleChange} required>
                    <option value="">Selecione uma sala</option>
                    {salasOrdenadas.map((sala) => (
                      <option key={sala.id} value={sala.id}>{sala.nome}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Data *
                  <input type="date" name="data" value={form.data} onChange={handleChange} required={!recorrente} disabled={recorrente} />
                </label>

                <label>
                  Início *
                  <select name="hora_inicio" value={form.hora_inicio} onChange={handleChange} required disabled={selectsDisabled}>
                    {horasInicioDisponiveis.length > 0 ? (
                      horasInicioDisponiveis.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))
                    ) : (
                      <option value="" disabled>Nenhum horário disponível</option>
                    )}
                  </select>
                </label>

                <label>
                  Fim *
                  <select name="hora_fim" value={form.hora_fim} onChange={handleChange} required disabled={selectsDisabled}>
                    {horasFimDisponiveis.length > 0 ? (
                      horasFimDisponiveis.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))
                    ) : (
                      <option value="" disabled>Nenhum horário disponível</option>
                    )}
                  </select>
                </label>

                <label>
                  Título *
                  <input type="text" name="titulo" value={form.titulo} onChange={handleChange} required disabled={camposTextDisabled} />
                </label>

                <label>
                  Responsável *
                  <input
                    type="text"
                    name="responsavel"
                    value={form.responsavel}
                    onChange={handleChange}
                    required
                    disabled={true}
                  />
                </label>

                <label>
                  E-mail *
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    disabled={true}
                  />
                </label>

                <label>
                  Descrição
                  <textarea name="descricao" value={form.descricao} onChange={handleChange} rows="3" disabled={camposTextDisabled} />
                </label>

                <div className="full-width">
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
                    Reserva recorrente (mesmo horário todas as semanas)
                  </label>
                </div>

                {recorrente && (
                  <>
                    <label className="full-width">
                      Dias da semana (segunda a sexta):
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {[
                          { label: 'Segunda', value: 0 },
                          { label: 'Terça', value: 1 },
                          { label: 'Quarta', value: 2 },
                          { label: 'Quinta', value: 3 },
                          { label: 'Sexta', value: 4 },
                        ].map((day) => (
                          <label key={day.value} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.3rem' }}>
                            <input
                              type="checkbox"
                              value={day.value}
                              checked={diasSelecionados.includes(day.value)}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (e.target.checked) {
                                  setDiasSelecionados([...diasSelecionados, val]);
                                } else {
                                  setDiasSelecionados(diasSelecionados.filter((d) => d !== val));
                                }
                              }}
                            />
                            {day.label}
                          </label>
                        ))}
                      </div>
                    </label>
                    <label>
                      Data final (repetir até):
                      <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} required />
                    </label>
                  </>
                )}

                <div className="actions">
                  <button type="submit" disabled={!dataSelecionada && !recorrente || (dataSelecionada && horasInicioDisponiveis.length === 0)}>
                    Reservar
                  </button>
                </div>
              </form>
            </section>

            <section className="box">
              <h2>📋 Reservas Confirmadas</h2>
              <div className="reservas-grid">
                {reservasAtivas.map((reserva) => {
                  const sala = salas.find((s) => s.id === reserva.sala_id);
                  return (
                    <div className="reserva-card" key={reserva.id}>
                      <h3>{reserva.sala_nome}</h3>
                      <p><strong>Título:</strong> {reserva.titulo}</p>
                      {reserva.grupo_id && <p><strong>Grupo:</strong> {reserva.grupo_id.substring(0, 8)}...</p>}
                      <p><strong>Data:</strong> {formatarData(reserva.data)}</p>
                      <p><strong>Horário:</strong> {reserva.hora_inicio} - {reserva.hora_fim}</p>
                      {sala && <p><strong>Localização:</strong> Bloco {sala.bloco || '?'} | {sala.andar || 'Andar não informado'}</p>}
                      <p><strong>Responsável:</strong> {reserva.responsavel}</p>
                      <p><strong>E-mail:</strong> {reserva.email}</p>
                      {reserva.descricao && <p><strong>Descrição:</strong> {reserva.descricao}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        );
    }
  };

  return (
    <div className="app-container app-fullscreen">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img src="/CBiot_logo.jpg" alt="CBiot" className="logo-sidebar" />
            <div>
              <strong>CBiot</strong>
              <span>Reserva de salas</span>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Principal</div>
            <button className={`sidebar-item ${activeTab === 'inicio' ? 'active' : ''}`} onClick={() => setActiveTab('inicio')}>Início</button>
            <button className={`sidebar-item ${activeTab === 'consultar' ? 'active' : ''}`} onClick={() => setActiveTab('consultar')}>Consultar disponibilidade</button>
            <button className={`sidebar-item ${activeTab === 'minhas-reservas' ? 'active' : ''}`} onClick={() => setActiveTab('minhas-reservas')}>Minhas reservas</button>
          </div>

          {userCanAdmin && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Administrativo</div>
              <button className={`sidebar-item ${activeTab === 'solicitacoes' ? 'active' : ''}`} onClick={() => setActiveTab('solicitacoes')}>Solicitações</button>
              <button className={`sidebar-item ${activeTab === 'reservas' ? 'active' : ''}`} onClick={() => setActiveTab('reservas')}>Reservas</button>
              {userIsAdmin && <button className={`sidebar-item ${activeTab === 'salas' ? 'active' : ''}`} onClick={() => setActiveTab('salas')}>Salas</button>}
              {userIsAdmin && <button className={`sidebar-item ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>Usuários</button>}
            </div>
          )}

          <div className="sidebar-section">
            <div className="sidebar-section-title">Conta</div>
            <button className={`sidebar-item ${activeTab === 'meus-dados' ? 'active' : ''}`} onClick={() => setActiveTab('meus-dados')}>Meus Dados</button>
            <button className="sidebar-item" onClick={handleLogout}>Voltar ao portal</button>
          </div>

          <div className="sidebar-footer">
            {currentUser ? (
              <>
                <div className="sidebar-avatar">{currentUser.nome ? currentUser.nome[0].toUpperCase() : currentUser.email?.[0].toUpperCase()}</div>
                <div>
                  <p>{currentUser.nome || currentUser.email}</p>
                  <small>{currentUser.cargo}</small>
                </div>
              </>
            ) : (
              <p>Carregando...</p>
            )}
          </div>
        </aside>

        <main className="main-content">
          <header className="page-header">
            <div>
              <h1>{pageTitle}</h1>
              <p>Bem-vindo de volta, {currentUser?.nome || 'usuário'}.</p>
            </div>
            <div className="page-header-actions">
              <span>{currentUser?.cargo}</span>
            </div>
          </header>

          {renderPageContent()}
        </main>
      </div>
    </div>
  );
}

export default App;