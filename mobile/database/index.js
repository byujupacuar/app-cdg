import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';

// 1. Configuramos el adaptador nativo
const adapter = new SQLiteAdapter({
  schema,
  jsi: true, // jsi: true activa la velocidad máxima (conexión directa C++)
  onSetUpError: error => {
    console.error("Error al iniciar WatermelonDB", error);
  }
});

// 2. Creamos la base de datos principal
export const database = new Database({
  adapter,
  modelClasses: [
    // En el Día 12 agregaremos los Modelos aquí
  ],
});