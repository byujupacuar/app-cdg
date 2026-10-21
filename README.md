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
separada del dinero disponible. En **Análisis** puedes filtrar los ingresos y
gastos por cuenta y período, consultar sus movimientos y exportarlos a CSV.
En la web, el menú con tu nombre en la parte superior muestra los miembros de la
cuenta, permite invitar a una pareja registrada y cerrar sesión.

Para habilitar el inicio de sesión real con Google, configura el consentimiento
OAuth en Google Cloud y crea Client IDs para Web, Android e iOS. En Render,
define `GOOGLE_CLIENT_IDS` con esos IDs separados por comas; son identificadores
públicos, no client secrets. La app móvil usa el paquete Android
`com.jupacuar.mobile`; para Android también se necesitan las huellas SHA-1 de
las claves de firma de desarrollo y producción, y para iOS un Bundle ID. Los
dominios web y móviles deben estar autorizados en la configuración OAuth.

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

Después de iniciar sesión con conexión, la app guarda la sesión de forma
segura y conserva una copia local de los movimientos, cuentas, categorías,
presupuestos, préstamos y transferencias. Así se pueden consultar los últimos
datos descargados al volver a abrirla sin internet. Los movimientos nuevos,
editados o eliminados se guardan primero en SQLite y se envían automáticamente
cuando vuelve la conexión. La app muestra un aviso mientras haya cambios por
sincronizar.

El primer inicio de sesión y la descarga inicial requieren internet. Después de
iniciar sesión, la app descarga los datos para consultar las secciones sin red.
En esta versión, las operaciones offline que se sincronizan son las de
movimientos; crear cuentas, categorías, presupuestos o préstamos y registrar
transferencias requiere conexión. Para probarlo, inicia sesión conectado,
espera a que termine la descarga, activa el modo avión y registra, edita o
elimina un movimiento. Al volver a conectarte, la app reintentará la
sincronización automáticamente hasta que el servidor confirme los cambios.

## Configuración local

Los archivos `.env` contienen configuración local y no deben subirse al
repositorio. Usa los archivos `.env.example` como plantillas.
