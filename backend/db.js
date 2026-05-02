import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salas (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(100) UNIQUE NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservas (
      id SERIAL PRIMARY KEY,
      sala_id INTEGER NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
      titulo VARCHAR(100) NOT NULL,
      data DATE NOT NULL,
      hora_inicio TIME NOT NULL,
      hora_fim TIME NOT NULL,
      responsavel VARCHAR(100) NOT NULL,
      email VARCHAR(100),
      descricao TEXT,
      criada_em TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export default pool;
