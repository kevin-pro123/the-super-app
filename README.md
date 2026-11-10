# the-super-app

App de pagos de transporte (Expo / React Native) con **PostgreSQL** y un servidor propio en Node.js (Express). Ya no usa Supabase.

```
the-super-app/
├── app/, components/, hooks/   ← la app (Expo)
├── lib/api.ts                  ← cliente que habla con el servidor
└── server/                     ← API en Express + PostgreSQL
    ├── schema.sql              ← tablas de la base de datos
    ├── index.js                ← rutas de la API
    └── .env.example            ← configuración (copiar como .env)
```

## Requisitos
- Node.js 20 o superior
- PostgreSQL 14 o superior (con pgAdmin si quieres verlo gráficamente)

## 1. Crear la base de datos
En pgAdmin crea una base llamada `superapp` (o con `psql -U postgres -c "CREATE DATABASE superapp"`).

## 2. Configurar y arrancar el servidor
```bash
cd server
npm install
```
Copia `server/.env.example` como `server/.env` y pon tu contraseña de PostgreSQL en `DATABASE_URL`.

```bash
npm run db:init
npm start
```
`db:init` crea las tablas (solo la primera vez). Debe aparecer `🚌 API escuchando en http://localhost:3000`.

Usuarios de prueba (contraseña `123456`): `pasajero@test.com` y `chofer@test.com`.

## 3. Arrancar la app (en otra terminal)
```bash
npm install
npm run dev
```
Presiona `w` para abrirla en el navegador o escanea el QR con Expo Go.
El celular y la PC deben estar en la misma red Wi‑Fi. La app busca el servidor automáticamente
en la IP de tu PC, puerto 3000. Si no lo encuentra, crea un `.env` en la raíz con:
```
EXPO_PUBLIC_API_URL=http://IP-DE-TU-PC:3000
```
En Windows, si el celular no conecta, permite Node.js en el Firewall de Windows.

## API
| Método | Ruta | Quién |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | todos |
| GET | `/auth/me` | con sesión |
| GET | `/buses/active` | con sesión |
| PUT | `/buses/me` | conductor |
| POST | `/payment-requests` | pasajero |
| GET | `/payment-requests/pending` | conductor |
| POST | `/payment-requests/:id/accept` · `/reject` | conductor |
| GET | `/transactions/earnings` | conductor |
| POST | `/wallet/deposit` | pasajero |
