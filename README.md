# Nivia

Aplicación de finanzas personales con backend, web y app móvil en un solo repositorio:

- `backend/`: API Express, Prisma y PostgreSQL.
- `web/`: aplicación web React.
- `mobile/`: aplicación móvil Expo y React Native.

## Backend

```bash
cd backend
npm install
cp .env.example .env
```

Configura `DATABASE_URL` y un `JWT_SECRET` propio en `backend/.env`. Después:

```bash
npx prisma generate
npx prisma migrate dev
npm run dev
```

La API queda disponible por defecto en `http://localhost:3000`.
En producción, aplica las migraciones pendientes con `npx prisma migrate deploy`
antes de iniciar la API.

## Web

En otra terminal:

```bash
cd web
npm install
cp .env.example .env
npm start
```

La web queda disponible por defecto en `http://localhost:3001`.

## Mobile

```bash
cd mobile
npm install
```

Configura `API_URL` en `mobile/api.js` con una dirección del backend que sea
accesible desde el dispositivo o emulador y luego ejecuta:

```bash
npm start
```

## Configuración local

Los archivos `.env` contienen configuración local y no deben subirse al
repositorio. Usa los archivos `.env.example` como plantillas.
