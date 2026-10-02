import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

/**
 * Adaptador de almacenamiento de archivos. La app sólo conoce esta interfaz:
 *   put(buffer, { ext }) → storageKey
 *   stream(storageKey)   → ReadStream
 *   remove(storageKey)
 *
 * Implementación local para desarrollo (carpeta fuera de cualquier ruta
 * pública). Para producción se puede agregar S3/Cloudinary/GridFS con la
 * misma interfaz y elegirla por variable de entorno.
 */
const serverRoot = fileURLToPath(new URL('../../', import.meta.url));
const baseDir = path.resolve(serverRoot, env.UPLOAD_DIR);

function resolveKey(key) {
  // Las claves son generadas por el sistema; aun así se evita path traversal.
  if (!/^[a-z0-9-]+\.[a-z0-9]+$/i.test(key)) throw new Error('storageKey inválida');
  return path.join(baseDir, key);
}

export const localStorage = {
  async put(buffer, { ext }) {
    await mkdir(baseDir, { recursive: true });
    const key = `${randomUUID()}.${ext}`;
    await writeFile(resolveKey(key), buffer, { flag: 'wx' });
    return key;
  },
  async stream(key) {
    const file = resolveKey(key);
    await stat(file); // lanza si no existe
    return createReadStream(file);
  },
  async remove(key) {
    await rm(resolveKey(key), { force: true });
  },
};

export const storage = localStorage;
