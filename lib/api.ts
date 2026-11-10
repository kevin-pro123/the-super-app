import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Precios por tipo de pasajero en soles peruanos
export const PRICES = {
  adult: 2.5,   // Adulto: S/. 2.50
  student: 1.5, // Estudiante: S/. 1.50 (con descuento)
  child: 1.0,   // Niño: S/. 1.00 (tarifa reducida)
};

// Dirección del servidor (carpeta /server). Si no se define EXPO_PUBLIC_API_URL,
// se usa la misma IP de la PC que ejecuta Expo, en el puerto 3000. Así funciona
// también desde el celular con Expo Go sin configurar nada.
function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3000`;
  }
  const hostUri = Constants.expoConfig?.hostUri; // ej. "192.168.1.5:8081"
  if (hostUri) return `http://${hostUri.split(':')[0]}:3000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000'; // emulador Android
  return 'http://localhost:3000';
}

export const API_URL = resolveApiUrl();

// ---- Sesión (token) ------------------------------------------------------

const TOKEN_KEY = 'superapp_token';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

let token: string | null = storage()?.getItem(TOKEN_KEY) ?? null;

type Listener = () => void;
const listeners = new Set<Listener>();

export function getToken() {
  return token;
}

export function setToken(value: string | null) {
  token = value;
  try {
    if (value) storage()?.setItem(TOKEN_KEY, value);
    else storage()?.removeItem(TOKEN_KEY);
  } catch {}
  notifyAuthChange();
}

// Avisa a todas las pantallas que usan useAuth() para que recarguen el usuario
export function notifyAuthChange() {
  listeners.forEach((listener) => listener());
}

export function onAuthChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---- Peticiones ---------------------------------------------------------

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(`No se pudo conectar con el servidor (${API_URL})`, 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) setToken(null);
    throw new ApiError(data?.error ?? 'Error del servidor', response.status);
  }
  return data as T;
}
