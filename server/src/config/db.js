import mongoose from 'mongoose';
import { logger } from './logger.js';

// Campos no declarados en el schema se ignoran en filtros.
// La defensa contra inyección NoSQL está en dos capas de entrada:
//   1. middleware/sanitize.js elimina claves que empiezan con `$` o contienen `.`
//   2. validators/* (zod estricto) sólo dejan pasar tipos primitivos esperados
// No se usa `sanitizeFilter` global porque neutraliza también los operadores
// legítimos que construyen los services ($gt, $in…).
mongoose.set('strictQuery', true);

export async function connectDB(uri) {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB desconectado'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconectado'));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Nunca se registra la URI (contiene credenciales); sólo el nombre de la BD.
  logger.info({ db: mongoose.connection.name }, 'MongoDB conectado');
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
