import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import pool, { initDb } from './db.js';

dotenv.config();

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo-reservasala',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 }
}));

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

const PORT = process.env.PORT || 4000;

const isAdmin = (req, res, next) => {
  if (req.session && req.session.admin) next();
  else res.status(401).json({ erro: 'Acesso não autorizado' });
};

function parseDate(value) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseTime(value) {
  const parts = value.split(':').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  const [hours, minutes] = parts;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function validateBusinessHours(data, horaInicio, horaFim) {
  // Usar a data diretamente sem conversão de fuso
  const reservaDate = new Date(data + 'T12:00:00'); // força meio-dia para evitar deslocamento
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reservaDate.setHours(0, 0, 0, 0);

  if (reservaDate < today) {
    return 'Não é possível reservar para datas já passadas';
  }

  // Se for hoje, verifica horário futuro
  if (reservaDate.getTime() === today.getTime()) {
    const now = new Date();
    const horaAtual = now.getHours();
    const minAtual = now.getMinutes();
    const [inicioHora] = horaInicio.split(':').map(Number);
    if (inicioHora < horaAtual || (inicioHora === horaAtual && 0 < minAtual)) {
      return 'Não é possível reservar para um horário que já passou hoje';
    }
  }

  // Obter o dia da semana usando a data UTC
// const dayOfWeek = reservaDate.getDay();
// if (dayOfWeek === 0 || dayOfWeek === 6) {
//   return 'Reservas só podem ser feitas de segunda a sexta-feira';
// }

  const [inicioHora, inicioMin] = horaInicio.split(':').map(Number);
  const [fimHora, fimMin] = horaFim.split(':').map(Number);
  if (inicioMin !== 0 || fimMin !== 0) return 'Reservas devem começar e terminar na hora cheia';
  if (inicioHora >= fimHora) return 'Hora de início deve ser anterior à hora de fim';
  if (inicioHora < 8 || inicioHora >= 19 || fimHora > 19) return 'Reservas só podem ocorrer entre 08:00 e 19:00';
  return null;
}

function formatReserva(row) {
  return {
    id: row.id,
    sala_id: row.sala_id,
    sala_nome: row.sala_nome,
    titulo: row.titulo,
    data: row.data.toISOString().slice(0, 10),
    hora_inicio: row.hora_inicio.slice(0, 5),
    hora_fim: row.hora_fim.slice(0, 5),
    responsavel: row.responsavel,
    email: row.email,
    descricao: row.descricao,
  };
}

// --- ROTAS PÚBLICAS ---
app.get('/api/salas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nome FROM salas ORDER BY nome');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar salas' });
  }
});

app.get('/api/reservas', async (req, res) => {
  const { sala_id, data } = req.query;
  const filters = [];
  const values = [];
  if (sala_id) { values.push(sala_id); filters.push(`reserva.sala_id = $${values.length}`); }
  if (data) {
    const parsed = parseDate(data);
    if (!parsed) return res.status(400).json({ erro: 'Formato de data inválido' });
    values.push(parsed);
    filters.push(`reserva.data = $${values.length}`);
  }
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const result = await pool.query(`
      SELECT reserva.*, sala.nome AS sala_nome
      FROM reservas reserva
      JOIN salas sala ON reserva.sala_id = sala.id
      ${whereClause}
      ORDER BY reserva.data, reserva.hora_inicio
    `, values);
    res.json(result.rows.map(formatReserva));
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar reservas' });
  }
});

app.post('/api/reservas', async (req, res) => {
  const { sala_id, titulo, data, hora_inicio, hora_fim, responsavel, email, descricao } = req.body;
  if (!sala_id || !titulo || !data || !hora_inicio || !hora_fim || !responsavel) {
    return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
  }
  const parsedData = parseDate(data);
  const parsedHoraInicio = parseTime(hora_inicio);
  const parsedHoraFim = parseTime(hora_fim);
  if (!parsedData || !parsedHoraInicio || !parsedHoraFim) {
    return res.status(400).json({ erro: 'Formato inválido de data ou hora' });
  }
  const validationError = validateBusinessHours(parsedData, parsedHoraInicio, parsedHoraFim);
  if (validationError) return res.status(400).json({ erro: validationError });
  try {
    const conflict = await pool.query(
      `SELECT 1 FROM reservas
       WHERE sala_id = $1 AND data = $2
       AND hora_inicio < $4 AND hora_fim > $3 LIMIT 1`,
      [sala_id, parsedData, parsedHoraInicio, parsedHoraFim]
    );
    if (conflict.rowCount > 0) return res.status(400).json({ erro: 'Conflito de horário: sala já reservada neste período' });
    const insert = await pool.query(
      `INSERT INTO reservas (sala_id, titulo, data, hora_inicio, hora_fim, responsavel, email, descricao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [sala_id, titulo, parsedData, parsedHoraInicio, parsedHoraFim, responsavel, email || '', descricao || '']
    );
    const reserva = { id: insert.rows[0].id, sala_id, sala_nome: '', titulo, data: parsedData, hora_inicio: parsedHoraInicio.slice(0,5), hora_fim: parsedHoraFim.slice(0,5), responsavel, email: email || '', descricao: descricao || '' };
    res.status(201).json(reserva);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar reserva' });
  }
});

// DISPONIBILIDADE CORRIGIDA (EXTRACT HOUR)
app.get('/api/disponibilidade', async (req, res) => {
  const { sala_id, data } = req.query;
  if (!sala_id || !data) return res.status(400).json({ erro: 'sala_id e data são obrigatórios' });
  const parsedData = parseDate(data);
  if (!parsedData) return res.status(400).json({ erro: 'Formato de data inválido' });
  try {
    const salaResult = await pool.query('SELECT id, nome FROM salas WHERE id = $1', [sala_id]);
    if (salaResult.rowCount === 0) return res.status(404).json({ erro: 'Sala não encontrada' });
    const reservasResult = await pool.query(
      `SELECT EXTRACT(HOUR FROM hora_inicio) AS inicio_hora, EXTRACT(HOUR FROM hora_fim) AS fim_hora
       FROM reservas WHERE sala_id = $1 AND data = $2::date`,
      [sala_id, parsedData]
    );
    const reservasNumericas = reservasResult.rows.map(r => ({ inicio: r.inicio_hora, fim: r.fim_hora }));
    const horarios = [];
    for (let i = 8; i <= 18; i++) {
      const inicio = `${String(i).padStart(2,'0')}:00`;
      const fim = `${String(i+1).padStart(2,'0')}:00`;
      let ocupado = false;
      for (const r of reservasNumericas) {
        if (i >= r.inicio && (i+1) <= r.fim) { ocupado = true; break; }
      }
      horarios.push({ hora_inicio: inicio, hora_fim: fim, ocupado, titulo: ocupado ? 'Reservado' : '' });
    }
    res.json({ sala_nome: salaResult.rows[0].nome, data: parsedData, horarios });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar disponibilidade' });
  }
});

// --- ROTAS ADMIN ---
app.post('/api/admin/login', async (req, res) => {
  const { senha } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (senha === adminPassword) { req.session.admin = true; res.json({ sucesso: true }); }
  else res.status(401).json({ erro: 'Senha inválida' });
});
app.post('/api/admin/logout', (req, res) => { req.session.destroy(); res.json({ sucesso: true }); });
app.post('/api/salas', isAdmin, async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  try {
    const result = await pool.query('INSERT INTO salas (nome) VALUES ($1) RETURNING id, nome', [nome]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ erro: 'Sala com este nome já existe' });
    res.status(500).json({ erro: 'Erro ao criar sala' });
  }
});
app.delete('/api/salas/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM salas WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ erro: 'Sala não encontrada' });
    res.json({ mensagem: 'Sala deletada com sucesso' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar sala' });
  }
});
app.delete('/api/reservas/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM reservas WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ erro: 'Reserva não encontrada' });
    res.json({ mensagem: 'Reserva cancelada com sucesso' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar reserva' });
  }
});
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

app.listen(PORT, async () => {
  await initDb();
  console.log(`Backend iniciado em http://localhost:${PORT}`);
});