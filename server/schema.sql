-- =====================================================================
--  the-super-app  ·  Esquema para PostgreSQL normal (sin Supabase)
--  Adaptado de supabase/migrations/20250830162117_warm_dew.sql
--  Cambios: se quitó auth.users, auth.uid() y las políticas RLS
--  (son exclusivas de Supabase) y se agregó password_hash a users.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid() y crypt()

-- Tipos
CREATE TYPE user_role          AS ENUM ('passenger', 'driver');
CREATE TYPE user_type          AS ENUM ('adult', 'child', 'student', 'driver');
CREATE TYPE payment_status     AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');

-- Usuarios (antes dependía de auth.users de Supabase)
CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  password_hash   text NOT NULL,
  full_name       text NOT NULL,
  role            user_role NOT NULL DEFAULT 'passenger',
  user_type       user_type NOT NULL DEFAULT 'adult',
  document_number text NOT NULL,
  balance         decimal(10,2) NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Buses
CREATE TABLE IF NOT EXISTS buses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  license_plate text NOT NULL,
  route         text NOT NULL,
  latitude      decimal(10,8) NOT NULL,
  longitude     decimal(11,8) NOT NULL,
  is_active     boolean DEFAULT true,
  updated_at    timestamptz DEFAULT now()
);

-- Solicitudes de pago
CREATE TABLE IF NOT EXISTS payment_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  bus_id          uuid REFERENCES buses(id) ON DELETE CASCADE,
  amount          decimal(10,2) NOT NULL,
  passenger_count jsonb NOT NULL DEFAULT '{"adults": 0, "children": 0, "students": 0}',
  status          payment_status DEFAULT 'pending',
  created_at      timestamptz DEFAULT now()
);

-- Transacciones
CREATE TABLE IF NOT EXISTS transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  driver_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  bus_id          uuid REFERENCES buses(id) ON DELETE CASCADE,
  amount          decimal(10,2) NOT NULL,
  passenger_count jsonb NOT NULL DEFAULT '{"adults": 0, "children": 0, "students": 0}',
  status          transaction_status DEFAULT 'pending',
  created_at      timestamptz DEFAULT now()
);

-- Actualizar saldo del pasajero
CREATE OR REPLACE FUNCTION update_passenger_balance(passenger_uuid uuid, amount decimal)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE users
  SET balance = GREATEST(0, balance + amount)
  WHERE id = passenger_uuid AND role = 'passenger';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passenger not found or invalid';
  END IF;
END;
$$;

-- updated_at automático en buses
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_buses_updated_at
  BEFORE UPDATE ON buses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_buses_driver_id             ON buses(driver_id);
CREATE INDEX IF NOT EXISTS idx_buses_location              ON buses(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_buses_active                ON buses(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_requests_passenger  ON payment_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_bus        ON payment_requests(bus_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status     ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_transactions_passenger      ON transactions(passenger_id);
CREATE INDEX IF NOT EXISTS idx_transactions_driver         ON transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status         ON transactions(status);

-- ---------------------------------------------------------------------
-- Datos de prueba (opcional). Contraseña de ambos: 123456
-- ---------------------------------------------------------------------
INSERT INTO users (email, password_hash, full_name, role, user_type, document_number, balance) VALUES
  ('pasajero@test.com', crypt('123456', gen_salt('bf')), 'Pasajero Prueba', 'passenger', 'adult',  '12345678', 20.00),
  ('chofer@test.com',   crypt('123456', gen_salt('bf')), 'Chofer Prueba',   'driver',    'driver', '87654321',  0.00);

INSERT INTO buses (driver_id, license_plate, route, latitude, longitude)
SELECT id, 'ABC-123', 'Ruta 1', -12.04637400, -77.04279300 FROM users WHERE email = 'chofer@test.com';
