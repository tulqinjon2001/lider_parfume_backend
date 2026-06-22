const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool;

function needsSsl(connectionString) {
  if (process.env.PGSSLMODE === 'disable') return false;
  if (/sslmode=disable/i.test(connectionString)) return false;
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL .env da sozlanishi kerak');
    }

    pool = new Pool({
      connectionString,
      ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

async function migrate() {
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await getPool().query(sql);
}

async function checkConnection() {
  await getPool().query('SELECT 1');
}

module.exports = { getPool, migrate, checkConnection };
