import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

const SESSION_TOKEN_KEY = 'nivia_session_token';
const DATABASE_NAME = 'nivia-offline.db';

let databasePromise;
let activeUserId = null;

const openDatabase = async () => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS app_cache (
          user_id TEXT NOT NULL,
          cache_key TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, cache_key)
        );
        CREATE TABLE IF NOT EXISTS pending_mutations (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          entity TEXT NOT NULL,
          action TEXT NOT NULL,
          payload TEXT NOT NULL,
          client_timestamp TEXT NOT NULL
        );
      `);
      return database;
    });
  }
  return databasePromise;
};

const requireUserId = () => {
  if (!activeUserId) {
    throw new Error('No hay una sesión local activa para guardar datos offline.');
  }
  return activeUserId;
};

export const setActiveUser = (user) => {
  activeUserId = user?.id || null;
};

export const saveSession = async (token, user) => {
  if (!token || !user?.id) {
    throw new Error('No se pudo guardar la sesión: faltan los datos del usuario.');
  }
  await openDatabase();
  setActiveUser(user);
  await cacheSet('session-user', user);
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, JSON.stringify({ token, user }));
};

export const loadSession = async () => {
  const storedSession = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  if (!storedSession) return null;
  const session = JSON.parse(storedSession);
  if (!session.token || !session.user?.id) return null;
  await openDatabase();
  setActiveUser(session.user);
  await cacheSet('session-user', session.user);
  return session;
};

export const clearSession = async () => {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  activeUserId = null;
};

export const cacheSet = async (key, value) => {
  const database = await openDatabase();
  const userId = requireUserId();
  await database.runAsync(
    `INSERT INTO app_cache (user_id, cache_key, payload, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, cache_key) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    userId,
    key,
    JSON.stringify(value),
    new Date().toISOString()
  );
};

export const cacheGet = async (key) => {
  const database = await openDatabase();
  const userId = requireUserId();
  const row = await database.getFirstAsync(
    'SELECT payload FROM app_cache WHERE user_id = ? AND cache_key = ?',
    userId,
    key
  );
  return row ? JSON.parse(row.payload) : null;
};

export const enqueueMutation = async ({ id, entity, action, data, clientTimestamp }) => {
  const database = await openDatabase();
  await database.runAsync(
    `INSERT INTO pending_mutations (id, user_id, entity, action, payload, client_timestamp)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       entity = excluded.entity,
       action = excluded.action,
       payload = excluded.payload,
       client_timestamp = excluded.client_timestamp`,
    id,
    requireUserId(),
    entity,
    action,
    JSON.stringify(data),
    clientTimestamp || new Date().toISOString()
  );
};

export const getPendingMutations = async () => {
  const database = await openDatabase();
  const rows = await database.getAllAsync(
    `SELECT id, entity, action, payload, client_timestamp
     FROM pending_mutations
     WHERE user_id = ?
     ORDER BY client_timestamp ASC`,
    requireUserId()
  );
  return rows.map((row) => ({
    tempId: row.id,
    entity: row.entity,
    action: row.action,
    data: JSON.parse(row.payload),
    clientTimestamp: row.client_timestamp
  }));
};

export const removePendingMutation = async (id, clientTimestamp) => {
  const database = await openDatabase();
  const result = clientTimestamp
    ? await database.runAsync(
      'DELETE FROM pending_mutations WHERE user_id = ? AND id = ? AND client_timestamp = ?',
      requireUserId(),
      id,
      clientTimestamp
    )
    : await database.runAsync(
      'DELETE FROM pending_mutations WHERE user_id = ? AND id = ?',
      requireUserId(),
      id
    );
  return result.changes > 0;
};

export const getPendingMutationCount = async () => {
  const database = await openDatabase();
  const result = await database.getFirstAsync(
    'SELECT COUNT(*) AS count FROM pending_mutations WHERE user_id = ?',
    requireUserId()
  );
  return result?.count || 0;
};
