// Crea las tablas ejecutando schema.sql en la base de datos de DATABASE_URL.
// Uso: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Base de datos creada correctamente');
  } catch (err) {
    console.error('❌ Error creando la base de datos:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
