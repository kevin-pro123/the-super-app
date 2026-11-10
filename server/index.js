require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!process.env.DATABASE_URL || !JWT_SECRET) {
  console.error('Falta DATABASE_URL o JWT_SECRET. Copia server/.env.example como server/.env y complétalo.');
  process.exit(1);
}

// Precios por tipo de pasajero en soles peruanos (los calcula el servidor)
const PRICES = { adult: 2.5, student: 1.5, child: 1.0 };

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC_USER_FIELDS =
  'id, email, full_name, role, user_type, document_number, balance, created_at';

// Envuelve rutas async para que los errores lleguen al manejador de errores
const route = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

const onlyRole = (role) => (req, res, next) =>
  req.userRole === role ? next() : res.status(403).json({ error: 'No autorizado' });

// ---------------------------------------------------------------- Auth

app.post('/auth/register', route(async (req, res) => {
  const { email, password, full_name, role, user_type, document_number } = req.body;
  if (!email || !password || !full_name || !document_number) {
    return res.status(400).json({ error: 'Completa todos los campos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, user_type, document_number)
       VALUES (lower($1), $2, $3, $4, $5, $6)
       RETURNING ${PUBLIC_USER_FIELDS}`,
      [email.trim(), hash, full_name, role || 'passenger', user_type || 'adult', document_number]
    );
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado' });
    throw err;
  }
}));

app.post('/auth/login', route(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_USER_FIELDS}, password_hash FROM users WHERE email = lower($1)`,
    [(email || '').trim()]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  delete user.password_hash;
  res.json({ token: signToken(user), user });
}));

app.get('/auth/me', auth, route(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = $1`,
    [req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
}));

// ---------------------------------------------------------------- Buses

// Buses activos, con el nombre del conductor (para el pasajero)
app.get('/buses/active', auth, route(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, json_build_object('full_name', u.full_name) AS users
     FROM buses b JOIN users u ON u.id = b.driver_id
     WHERE b.is_active = true`
  );
  res.json(rows);
}));

// El conductor actualiza su ubicación (crea su bus si no existe)
app.put('/buses/me', auth, onlyRole('driver'), route(async (req, res) => {
  const { latitude, longitude, is_active } = req.body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Ubicación inválida' });
  }

  const updated = await pool.query(
    `UPDATE buses SET latitude = $2, longitude = $3, is_active = $4
     WHERE driver_id = $1 RETURNING *`,
    [req.userId, latitude, longitude, is_active !== false]
  );
  if (updated.rows[0]) return res.json(updated.rows[0]);

  const created = await pool.query(
    `INSERT INTO buses (driver_id, license_plate, route, latitude, longitude, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      req.userId,
      `BUS-${req.userId.slice(0, 6)}`,
      `Ruta ${Math.floor(Math.random() * 100)}`,
      latitude,
      longitude,
      is_active !== false,
    ]
  );
  res.status(201).json(created.rows[0]);
}));

// ---------------------------------------------------------------- Pagos

// El pasajero crea una solicitud de pago (el monto se calcula aquí)
app.post('/payment-requests', auth, onlyRole('passenger'), route(async (req, res) => {
  const { bus_id, passenger_count } = req.body;
  const count = {
    adults: Math.max(0, parseInt(passenger_count?.adults, 10) || 0),
    children: Math.max(0, parseInt(passenger_count?.children, 10) || 0),
    students: Math.max(0, parseInt(passenger_count?.students, 10) || 0),
  };
  const amount =
    count.adults * PRICES.adult + count.children * PRICES.child + count.students * PRICES.student;
  if (amount <= 0) return res.status(400).json({ error: 'Selecciona al menos un pasajero' });

  const { rows: me } = await pool.query('SELECT balance FROM users WHERE id = $1', [req.userId]);
  if (!me[0] || me[0].balance < amount) {
    return res.status(400).json({ error: 'Saldo insuficiente' });
  }

  const { rows } = await pool.query(
    `INSERT INTO payment_requests (passenger_id, bus_id, amount, passenger_count, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [req.userId, bus_id, amount, count]
  );
  res.status(201).json(rows[0]);
}));

// Solicitudes pendientes para el bus del conductor
app.get('/payment-requests/pending', auth, onlyRole('driver'), route(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT pr.*,
            json_build_object('full_name', u.full_name) AS users,
            json_build_object('license_plate', b.license_plate, 'route', b.route) AS buses
     FROM payment_requests pr
     JOIN buses b ON b.id = pr.bus_id
     JOIN users u ON u.id = pr.passenger_id
     WHERE b.driver_id = $1 AND pr.status = 'pending'
     ORDER BY pr.created_at DESC`,
    [req.userId]
  );
  res.json(rows);
}));

// El conductor acepta: descuenta saldo, registra transacción y marca aceptada (todo o nada)
app.post('/payment-requests/:id/accept', auth, onlyRole('driver'), route(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT pr.* FROM payment_requests pr
       JOIN buses b ON b.id = pr.bus_id
       WHERE pr.id = $1 AND b.driver_id = $2 AND pr.status = 'pending'
       FOR UPDATE OF pr`,
      [req.params.id, req.userId]
    );
    const request = rows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const charged = await client.query(
      `UPDATE users SET balance = balance - $2
       WHERE id = $1 AND role = 'passenger' AND balance >= $2`,
      [request.passenger_id, request.amount]
    );
    if (charged.rowCount === 0) {
      await client.query(`UPDATE payment_requests SET status = 'rejected' WHERE id = $1`, [request.id]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'El pasajero no tiene saldo suficiente' });
    }

    await client.query(
      `INSERT INTO transactions (passenger_id, driver_id, bus_id, amount, passenger_count, status)
       VALUES ($1, $2, $3, $4, $5, 'completed')`,
      [request.passenger_id, req.userId, request.bus_id, request.amount, request.passenger_count]
    );
    await client.query(`UPDATE payment_requests SET status = 'accepted' WHERE id = $1`, [request.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

app.post('/payment-requests/:id/reject', auth, onlyRole('driver'), route(async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE payment_requests pr SET status = 'rejected'
     FROM buses b
     WHERE pr.id = $1 AND b.id = pr.bus_id AND b.driver_id = $2 AND pr.status = 'pending'`,
    [req.params.id, req.userId]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Billetera

app.get('/transactions/earnings', auth, onlyRole('driver'), route(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
     WHERE driver_id = $1 AND status = 'completed'`,
    [req.userId]
  );
  res.json({ total: rows[0].total });
}));

app.post('/wallet/deposit', auth, onlyRole('passenger'), route(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!(amount > 0) || amount > 10000) return res.status(400).json({ error: 'Monto inválido' });
  await pool.query('SELECT update_passenger_balance($1, $2)', [req.userId, amount]);
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = $1`,
    [req.userId]
  );
  res.json(rows[0]);
}));

// ---------------------------------------------------------------- Errores

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === '22P02' || err.code === '23503') {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  res.status(500).json({ error: 'Error del servidor' });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚌 API escuchando en http://localhost:${port}`);
});
