const { Pool, types } = require('pg');

// PostgreSQL devuelve los DECIMAL como texto; los convertimos a número
types.setTypeParser(1700, (value) => parseFloat(value));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
