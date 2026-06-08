import React, { useState, useEffect } from 'react';
import { createReserva, createReservaRecorrente, getDisponibilidade } from '../api';

const InfoIcon = ({ color = "#10b981", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

const normalizeTime = (timeStr) => {
  if (!timeStr) return '';
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return timeStr;
};

const formatDate = (isoDate) => {
  if (!isoDate) return 'dd/mm/aaaa';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

const ReservaModal = ({ isOpen, onClose, salas, currentUser, userRole, initialData }) => {
  const isExterno = userRole === 'externo';
  const [form, setForm] = useState({
    sala_id: '',
    titulo: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
  });
  const [recorrente, setRecorrente] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictData, setConflictData] = useState({ conflitos: [], grupo_id: null, reservasCriadas: [] });
  const [disponibilidade, setDisponibilidade] = useState(null);
  const [horariosLivres, setHorariosLivres] = useState([]);
  const [horariosFimPossiveis, setHorariosFimPossiveis] = useState([]);

  // Quando o modal abre ou initialData muda, atualiza o formulário com os dados recebidos
  useEffect(() => {
    if (isOpen && initialData) {
      setForm({
        sala_id: initialData.sala_id || '',
        titulo: initialData.titulo || '',
        data: initialData.data || '',
        hora_inicio: initialData.hora_inicio || '',
        hora_fim: initialData.hora_fim || '',
      });
    }
  }, [isOpen, initialData]);

  // Limpa mensagens e estado de conflito ao abrir
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setShowConflictWarning(false);
      setConflictData({ conflitos: [], grupo_id: null, reservasCriadas: [] });
    }
  }, [isOpen]);

  // Busca disponibilidade (apenas quando não recorrente e com sala/data)
  useEffect(() => {
    if (!recorrente && form.sala_id && form.data) {
      getDisponibilidade(form.sala_id, form.data).then((res) => {
        if (res && res.horarios) {
          const horariosNormalizados = res.horarios.map(h => ({
            ...h,
            hora_inicio: normalizeTime(h.hora_inicio),
            hora_fim: normalizeTime(h.hora_fim)
          }));
          setDisponibilidade({ ...res, horarios: horariosNormalizados });
          const livres = horariosNormalizados.filter(h => !h.ocupado).map(h => h.hora_inicio);
          setHorariosLivres(livres);
          if (form.hora_inicio && !livres.includes(form.hora_inicio)) {
            setForm(prev => ({ ...prev, hora_inicio: '', hora_fim: '' }));
            setHorariosFimPossiveis([]);
          }
        } else {
          setDisponibilidade(null);
          setHorariosLivres([]);
          setHorariosFimPossiveis([]);
        }
      });
    } else {
      setDisponibilidade(null);
      setHorariosLivres([]);
      setHorariosFimPossiveis([]);
    }
  }, [form.sala_id, form.data, recorrente]);

  // Calcula horários de fim possíveis (apenas para não recorrente)
  useEffect(() => {
    if (recorrente) {
      setHorariosFimPossiveis([]);
      return;
    }
    if (!disponibilidade || !form.hora_inicio) {
      setHorariosFimPossiveis([]);
      return;
    }
    const inicioIndex = disponibilidade.horarios.findIndex(h => h.hora_inicio === form.hora_inicio);
    if (inicioIndex === -1) {
      setHorariosFimPossiveis([]);
      return;
    }
    const possiveis = [];
    const blocoInicio = disponibilidade.horarios[inicioIndex];
    if (!blocoInicio.ocupado) possiveis.push(blocoInicio.hora_fim);
    for (let i = inicioIndex + 1; i < disponibilidade.horarios.length; i++) {
      const bloco = disponibilidade.horarios[i];
      if (bloco.ocupado) break;
      possiveis.push(bloco.hora_fim);
    }
    setHorariosFimPossiveis(possiveis);
    if (form.hora_fim && !possiveis.includes(form.hora_fim)) {
      setForm(prev => ({ ...prev, hora_fim: '' }));
    }
  }, [form.hora_inicio, disponibilidade, recorrente]);

  if (!isOpen) return null;

  const diasSemana = [
    { label: 'Segunda', value: 0 },
    { label: 'Terça', value: 1 },
    { label: 'Quarta', value: 2 },
    { label: 'Quinta', value: 3 },
    { label: 'Sexta', value: 4 },
  ];

  const handleToggleDia = (diaValue) => {
    if (diasSelecionados.includes(diaValue))
      setDiasSelecionados(diasSelecionados.filter(d => d !== diaValue));
    else
      setDiasSelecionados([...diasSelecionados, diaValue]);
  };

  const calcularNumeroOcorrencias = () => {
    if (!recorrente || !form.data || !dataFim || diasSelecionados.length === 0) return 0;
    const start = new Date(form.data);
    const end = new Date(dataFim);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const weekDay = d.getDay();
      const mappedDay = weekDay === 0 ? 6 : weekDay - 1;
      if (diasSelecionados.includes(mappedDay)) count++;
    }
    return count;
  };

  const numeroOcorrencias = calcularNumeroOcorrencias();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setShowConflictWarning(false);
    setLoading(true);

    if (!form.sala_id) { setErrorMessage('Selecione uma sala.'); setLoading(false); return; }
    if (!form.titulo.trim()) { setErrorMessage('Preencha a finalidade.'); setLoading(false); return; }
    if (!recorrente && (!form.data || !form.hora_inicio || !form.hora_fim)) {
      setErrorMessage('Selecione data, início e fim.'); setLoading(false); return;
    }
    if (recorrente && (!form.data || !dataFim || diasSelecionados.length === 0)) {
      setErrorMessage('Preencha data de início, data final e pelo menos um dia da semana.'); setLoading(false); return;
    }
    if (!recorrente && form.data) {
      const dataObj = new Date(form.data);
      if (dataObj.getDay() === 0 || dataObj.getDay() === 6) {
        setErrorMessage('Reservas não são permitidas aos sábados e domingos.'); setLoading(false); return;
      }
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
        responsavel: currentUser?.nome,
        email: currentUser?.email,
        descricao: '',
      };
      response = await createReservaRecorrente(payload);
    } else {
      response = await createReserva({
        sala_id: form.sala_id,
        titulo: form.titulo,
        data: form.data,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        responsavel: currentUser?.nome,
        email: currentUser?.email,
        descricao: '',
      });
    }

    if (response.erro) {
      setErrorMessage(response.erro);
      setLoading(false);
    } else if (recorrente && response.conflitos && response.conflitos.length > 0) {
      setConflictData({
        conflitos: response.conflitos,
        grupo_id: response.grupo_id,
        reservasCriadas: response.reservas_criadas
      });
      setShowConflictWarning(true);
      setLoading(false);
    } else {
      setErrorMessage(response.mensagem || 'Reserva criada com sucesso!');
      setLoading(false);
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1500);
    }
  };

  const handleProceedWithConflicts = () => {
    setErrorMessage(`${conflictData.reservasCriadas.length} reservas criadas. Conflitos ignorados.`);
    setShowConflictWarning(false);
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 1500);
  };

  const handleCancelWithConflicts = async () => {
    if (conflictData.grupo_id) {
      await fetch(`http://localhost:5000/api/reservas/grupo/${conflictData.grupo_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    }
    setShowConflictWarning(false);
    setErrorMessage('Operação cancelada. Nenhuma reserva foi criada.');
    setTimeout(() => {
      setErrorMessage('');
      onClose();
    }, 2000);
  };

  const isHorarioDisabled = recorrente 
    ? !form.sala_id 
    : !form.sala_id || !form.data || horariosLivres.length === 0;

  const diasTexto = diasSelecionados.map(v => diasSemana.find(d => d.value === v)?.label).join(', ');

  return (
    <div className="reserva-overlay" onClick={onClose}>
      <div className="reserva-container" onClick={(e) => e.stopPropagation()}>
        <div className="reserva-header">
          <h2>Solicitar reserva</h2>
          <p>A solicitação será analisada pelo gerente do CBiot.</p>
        </div>

        {errorMessage && (
          <div className={`reserva-message ${errorMessage.includes('sucesso') || errorMessage.includes('criada') ? 'success' : 'error'}`}>
            {errorMessage}
          </div>
        )}

        {showConflictWarning && (
          <div className="reserva-conflict-warning">
            <strong>Conflitos detectados</strong>
            <p>As seguintes datas não puderam ser reservadas:</p>
            <ul>
              {conflictData.conflitos.map((data, idx) => (
                <li key={idx}>{formatDate(data)}</li>
              ))}
            </ul>
            <p>Deseja prosseguir com as <strong>{conflictData.reservasCriadas.length} reserva(s)</strong> disponíveis? As datas conflitantes serão ignoradas.</p>
            <div className="reserva-conflict-buttons">
              <button type="button" className="btn-proceed" onClick={handleProceedWithConflicts}>Prosseguir (ignorar conflitos)</button>
              <button type="button" className="btn-cancel-conflict" onClick={handleCancelWithConflicts}>Cancelar operação</button>
            </div>
          </div>
        )}

        {isExterno && !showConflictWarning && (
          <div className="reserva-alert-warning">
            <InfoIcon color="#f59e0b" size={20} />
            <span>Sua solicitação ficará Pendente até a aprovação.</span>
          </div>
        )}

        {!showConflictWarning && (
          <form className="reserva-form" onSubmit={handleSubmit}>
            <div className="reserva-gray-group">
              <div className="reserva-row">
                <div className="reserva-field">
                  <label>SALA</label>
                  <select
                    value={form.sala_id}
                    onChange={(e) => setForm({ ...form, sala_id: e.target.value, hora_inicio: '', hora_fim: '' })}
                    required
                  >
                    <option value="">Selecione uma sala</option>
                    {salas?.map((s) => (<option key={s.id} value={s.id}>{s.nome}</option>))}
                  </select>
                </div>
                {!recorrente && (
                  <div className="reserva-field">
                    <label>DATA</label>
                    <input
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm({ ...form, data: e.target.value, hora_inicio: '', hora_fim: '' })}
                      required={!recorrente}
                    />
                  </div>
                )}
              </div>

              <div className="reserva-time-section">
                <div className="reserva-time-column">
                  <label>INÍCIO</label>
                  <select
                    value={form.hora_inicio}
                    onChange={(e) => setForm({ ...form, hora_inicio: e.target.value, hora_fim: '' })}
                    disabled={isHorarioDisabled}
                  >
                    <option value="" disabled>Selecione o horário de início</option>
                    {(recorrente ? generateAllStartTimes() : horariosLivres).map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div className="reserva-time-column">
                  <label>FIM</label>
                  <select
                    value={form.hora_fim}
                    onChange={(e) => setForm({ ...form, hora_fim: e.target.value })}
                    disabled={!form.hora_inicio || (recorrente ? false : horariosFimPossiveis.length === 0)}
                  >
                    <option value="" disabled>Selecione o horário de fim</option>
                    {(recorrente ? generateAllEndTimes().filter(t => timeToMinutes(t) > timeToMinutes(form.hora_inicio)) : horariosFimPossiveis).map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="reserva-field">
                <label>FINALIDADE</label>
                <textarea
                  placeholder="Reunião do grupo de pesquisa"
                  rows={3}
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className={`reserva-recorrente-section ${recorrente ? 'active' : ''}`}>
              <label className="reserva-checkbox-horizontal">
                <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
                <span className="reserva-custom-box"></span>
                <span className="reserva-label-text">Solicitação recorrente</span>
              </label>
              {recorrente && (
                <div className="reserva-recorrente-expanded" style={{ marginTop: '20px' }}>
                  <div className="reserva-row">
                    <div className="reserva-field">
                      <label>REPETIR</label>
                      <div className="reserva-dias-semana">
                        {diasSemana.map(dia => (
                          <button
                            key={dia.value}
                            type="button"
                            className={`reserva-dia-botao ${diasSelecionados.includes(dia.value) ? 'active' : ''}`}
                            onClick={() => handleToggleDia(dia.value)}
                          >
                            {dia.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="reserva-field">
                      <label>ATÉ</label>
                      <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} required />
                    </div>
                  </div>
                  {isExterno && (
                    <div className="reserva-info-box">
                      <p>{numeroOcorrencias} solicitação(ões) será(ão) enviada(s) para análise</p>
                      <p className="reserva-small-text">
                        {diasTexto ? `Toda(s) ${diasTexto.toLowerCase()}` : 'Selecione os dias'} de {formatDate(form.data)} até {formatDate(dataFim)} - das {form.hora_inicio || '--:--'} às {form.hora_fim || '--:--'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="reserva-footer-actions">
              <button type="button" className="btn-cancel-flat" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-submit-purple" disabled={loading}>
                {loading ? 'Enviando...' : recorrente ? `Enviar ${numeroOcorrencias} solicitações` : 'Enviar solicitação'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Funções auxiliares que faltavam dentro do escopo do componente
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};
const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
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

export default ReservaModal;