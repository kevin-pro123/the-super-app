import { createClient } from '@supabase/supabase-js';

// These will be replaced with actual values when you connect to Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Precios por tipo de pasajero en soles peruanos
export const PRICES = {
  adult: 2.5,   // Adulto: S/. 2.50
  student: 1.5, // Estudiante: S/. 1.50 (con descuento)
  child: 1.0,   // Niño: S/. 1.00 (tarifa reducida)
};