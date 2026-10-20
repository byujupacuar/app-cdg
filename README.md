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
`npm start` regenera el cliente Prisma, aplica las migraciones pendientes con
`prisma migrate deploy` y luego inicia la API.

En Render, configura el directorio raíz del servicio como `backend`, el comando
de compilación como `npm install` y el comando de inicio como `npm start`.
No uses `node index.js` como comando de inicio: omite las migraciones y puede
dejar el esquema de PostgreSQL desactualizado respecto del cliente Prisma.

La sección **Cuentas** permite añadir efectivo, cuentas bancarias, tarjetas de
débito vinculadas a un banco, tarjetas de crédito y tipos personalizados. Los
saldos iniciales pueden ajustarse; las transferencias actualizan ambos lados
sin contarse como ingresos o gastos. La deuda de tarjetas de crédito se muestra
separada del dinero disponible.

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
