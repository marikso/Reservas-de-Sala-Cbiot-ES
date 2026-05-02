import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initDb } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseTime(value) {
  const parts = value.split(':').map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  const [hours, minutes] = parts;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function validateBusinessHours(data, horaInicio, horaFim) {
  const today = new Date();
  const reservaDate = new Date(data);
  reservaDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (reservaDate < today) {
    return 'Não é possível reservar para datas já passadas';
  }

  const dayOfWeek = reservaDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'Reservas só podem ser feitas de segunda a sexta-feira';
  }

  const [inicioHora, inicioMin] = horaInicio.split(':').map(Number);
  const [fimHora, fimMin] = horaFim.split(':').map(Number);

  if (inicioMin !== 0 || fimMin !== 0) {
    return 'Reservas devem começar e terminar na hora';
  }

  if (inicioHora >= fimHora) {
    return 'Hora de início deve ser anterior à hora de fim';
  }

  if (inicioHora < 8 || inicioHora >= 19 || fimHora > 19) {
    return 'Reservas só podem ocorrer entre 08:00 e 19:00, com último bloco terminando às 19:00';
  }

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

app.get('/api/salas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nome FROM salas ORDER BY nome');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar salas' });
  }
});

app.post('/api/salas', async (req, res) => {
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ erro: 'Nome é obrigatório' });
  }

  try {
    const result = await pool.query('INSERT INTO salas (nome) VALUES ($1) RETURNING id, nome', [nome]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ erro: 'Sala com este nome já existe' });
    }
    res.status(500).json({ erro: 'Erro ao criar sala' });
  }
});

app.delete('/api/salas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM salas WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Sala não encontrada' });
    }
    res.json({ mensagem: 'Sala deletada com sucesso' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar sala' });
  }
});

app.get('/api/reservas', async (req, res) => {
  const { sala_id, data } = req.query;
  const filters = [];
  const values = [];

  if (sala_id) {
    values.push(sala_id);
    filters.push(`reserva.sala_id = $${values.length}`);
  }

  if (data) {
    const parsed = parseDate(data);
    if (!parsed) {
      return res.status(400).json({ erro: 'Formato de data inválido' });
    }
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
  if (validationError) {
    return res.status(400).json({ erro: validationError });
  }

  try {
    const conflict = await pool.query(
      `SELECT 1
       FROM reservas
       WHERE sala_id = $1
         AND data = $2
         AND hora_inicio < $4
         AND hora_fim > $3
       LIMIT 1`,
      [sala_id, parsedData, parsedHoraInicio, parsedHoraFim]
    );

    if (conflict.rowCount > 0) {
      return res.status(400).json({ erro: 'Conflito de horário: sala já está reservada neste período' });
    }

    const insert = await pool.query(
      `INSERT INTO reservas (sala_id, titulo, data, hora_inicio, hora_fim, responsavel, email, descricao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [sala_id, titulo, parsedData, parsedHoraInicio, parsedHoraFim, responsavel, email || '', descricao || '']
    );

    const reserva = {
      id: insert.rows[0].id,
      sala_id,
      sala_nome: '',
      titulo,
      data: parsedData,
      hora_inicio: parsedHoraInicio.slice(0, 5),
      hora_fim: parsedHoraFim.slice(0, 5),
      responsavel,
      email: email || '',
      descricao: descricao || '',
    };

    res.status(201).json(reserva);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar reserva' });
  }
});

app.delete('/api/reservas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM reservas WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Reserva não encontrada' });
    }
    res.json({ mensagem: 'Reserva cancelada com sucesso' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar reserva' });
  }
});

app.get('/api/disponibilidade', async (req, res) => {
  const { sala_id, data } = req.query;
  if (!sala_id || !data) {
    return res.status(400).json({ erro: 'sala_id e data são obrigatórios' });
  }

  const parsedData = parseDate(data);
  if (!parsedData) {
    return res.status(400).json({ erro: 'Formato de data inválido (use YYYY-MM-DD)' });
  }

  try {
    const salaResult = await pool.query('SELECT id, nome FROM salas WHERE id = $1', [sala_id]);
    if (salaResult.rowCount === 0) {
      return res.status(404).json({ erro: 'Sala não encontrada' });
    }

    const reservasResult = await pool.query(
      `SELECT hora_inicio, hora_fim FROM reservas
       WHERE sala_id = $1 AND data = $2
       ORDER BY hora_inicio`,
      [sala_id, parsedData]
    );

    const bloqueados = reservasResult.rows.map((row) => [row.hora_inicio.slice(0, 5), row.hora_fim.slice(0, 5)]);
    const reservaPorHorario = new Map(bloqueados.map(([inicio, fim]) => [`${inicio}-${fim}`, 'Reservado']));

    const disponiveis = [];
    const horarios = [];
    let horaAtual = 8;

    while (horaAtual < 19) {
      const inicio = `${String(horaAtual).padStart(2, '0')}:00`;
      const fim = `${String(horaAtual + 1).padStart(2, '0')}:00`;
      const temConflito = bloqueados.some(([hi, hf]) => inicio < hf && fim > hi);
      const titulo = temConflito ? reservaPorHorario.get(`${inicio}-${fim}`) || 'Reservado' : '';

      if (!temConflito) {
        disponiveis.push([inicio, fim]);
      }

      horarios.push({ hora_inicio: inicio, hora_fim: fim, ocupado: temConflito, titulo });
      horaAtual += 1;
    }

    res.json({
      sala_nome: salaResult.rows[0].nome,
      data: parsedData,
      disponiveis,
      reservadas: bloqueados,
      horarios,
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar disponibilidade' });
  }
});

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

app.listen(PORT, async () => {
  await initDb();
  console.log(`Backend iniciado em http://localhost:${PORT}`);
});
