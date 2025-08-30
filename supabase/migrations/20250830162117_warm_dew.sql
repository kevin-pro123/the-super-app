/*
  # Transport Payment System Database Schema

  ## Overview
  This migration sets up the complete database schema for a transport payment system
  that allows passengers to pay for bus rides and drivers to receive payments.

  ## Tables Created

  1. **users** - Extended user profiles with balance and role information
     - `id` (uuid, primary key) - Links to auth.users
     - `email` (text, unique, not null)
     - `full_name` (text, not null)
     - `role` (enum: 'passenger' | 'driver')
     - `user_type` (enum: 'adult' | 'child' | 'student' | 'driver')
     - `document_number` (text, not null) - ID/license number
     - `balance` (decimal, default 0) - Current wallet balance
     - `created_at` (timestamptz, default now())

  2. **buses** - Bus/vehicle information and real-time location
     - `id` (uuid, primary key)
     - `driver_id` (uuid, foreign key to users)
     - `license_plate` (text, not null)
     - `route` (text, not null) - Route name/description
     - `latitude` (decimal, not null) - Current GPS latitude
     - `longitude` (decimal, not null) - Current GPS longitude
     - `is_active` (boolean, default true) - Whether bus is currently active
     - `updated_at` (timestamptz, default now())

  3. **payment_requests** - Pending payment requests from passengers
     - `id` (uuid, primary key)
     - `passenger_id` (uuid, foreign key to users)
     - `bus_id` (uuid, foreign key to buses)
     - `amount` (decimal, not null) - Total payment amount
     - `passenger_count` (jsonb, not null) - Number of each passenger type
     - `status` (enum: 'pending' | 'accepted' | 'rejected', default 'pending')
     - `created_at` (timestamptz, default now())

  4. **transactions** - Completed payment transactions
     - `id` (uuid, primary key)
     - `passenger_id` (uuid, foreign key to users)
     - `driver_id` (uuid, foreign key to users)
     - `bus_id` (uuid, foreign key to buses)
     - `amount` (decimal, not null) - Transaction amount
     - `passenger_count` (jsonb, not null) - Number of each passenger type
     - `status` (enum: 'pending' | 'completed' | 'failed', default 'pending')
     - `created_at` (timestamptz, default now())

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies ensure users can only access their own data
  - Drivers can see payment requests for their buses
  - Public read access for bus locations (for proximity detection)

  ## Functions
  - `update_passenger_balance(passenger_id, amount)` - Safely update user balance
  - Automatic timestamp updates on record changes
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('passenger', 'driver');
CREATE TYPE user_type AS ENUM ('adult', 'child', 'student', 'driver');
CREATE TYPE payment_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'passenger',
  user_type user_type NOT NULL DEFAULT 'adult',
  document_number text NOT NULL,
  balance decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Buses table
CREATE TABLE IF NOT EXISTS buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES users(id) ON DELETE CASCADE,
  license_plate text NOT NULL,
  route text NOT NULL,
  latitude decimal(10,8) NOT NULL,
  longitude decimal(11,8) NOT NULL,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- Payment requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid REFERENCES users(id) ON DELETE CASCADE,
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  passenger_count jsonb NOT NULL DEFAULT '{"adults": 0, "children": 0, "students": 0}',
  status payment_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid REFERENCES users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES users(id) ON DELETE CASCADE,
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  passenger_count jsonb NOT NULL DEFAULT '{"adults": 0, "children": 0, "students": 0}',
  status transaction_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for buses table
CREATE POLICY "Anyone can read active buses"
  ON buses FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Drivers can manage own buses"
  ON buses FOR ALL
  TO authenticated
  USING (driver_id = auth.uid());

-- RLS Policies for payment_requests table
CREATE POLICY "Passengers can read own payment requests"
  ON payment_requests FOR SELECT
  TO authenticated
  USING (passenger_id = auth.uid());

CREATE POLICY "Passengers can create payment requests"
  ON payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (passenger_id = auth.uid());

CREATE POLICY "Drivers can read payment requests for their buses"
  ON payment_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buses 
      WHERE buses.id = payment_requests.bus_id 
      AND buses.driver_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update payment requests for their buses"
  ON payment_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buses 
      WHERE buses.id = payment_requests.bus_id 
      AND buses.driver_id = auth.uid()
    )
  );

-- RLS Policies for transactions table
CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (passenger_id = auth.uid() OR driver_id = auth.uid());

CREATE POLICY "Drivers can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (driver_id = auth.uid());

-- Function to safely update passenger balance
CREATE OR REPLACE FUNCTION update_passenger_balance(
  passenger_uuid uuid,
  amount decimal
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users 
  SET balance = GREATEST(0, balance + amount)
  WHERE id = passenger_uuid AND role = 'passenger';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passenger not found or invalid';
  END IF;
END;
$$;

-- Function to update bus timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update buses timestamp
CREATE TRIGGER update_buses_updated_at 
  BEFORE UPDATE ON buses 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_buses_driver_id ON buses(driver_id);
CREATE INDEX IF NOT EXISTS idx_buses_location ON buses(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_buses_active ON buses(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_requests_passenger ON payment_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_bus ON payment_requests(bus_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_transactions_passenger ON transactions(passenger_id);
CREATE INDEX IF NOT EXISTS idx_transactions_driver ON transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);