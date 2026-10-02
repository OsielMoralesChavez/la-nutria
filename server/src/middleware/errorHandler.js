import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada'));
}

/** Traduce errores conocidos a ApiError. Lo demás es 500 genérico. */
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.validation(
      Object.values(err.errors).map((e) => ({ location: 'body', field: e.path, message: e.message })),
    );
  }
  if (err instanceof mongoose.Error.CastError) return ApiError.notFound();
  if (err?.code === 11000) {
    return ApiError.conflict('Ya existe un registro con esos datos', { fields: Object.keys(err.keyPattern ?? {}) });
  }
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('JSON inválido');
  if (err?.type === 'entity.too.large') return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande');
  if (err?.code === 'LIMIT_FILE_SIZE') return new ApiError(413, 'FILE_TOO_LARGE', 'El archivo excede el tamaño permitido');

  return null;
}

/**
 * Manejador central. Al cliente sólo llega: código, mensaje apto para usuario,
 * detalles de validación y requestId. Stack y mensaje interno van al log.
 */
export function errorHandler(err, req, res, _next) {
  const apiErr = normalize(err);
  const status = apiErr?.status ?? 500;

  if (status >= 500) {
    req.log?.error({ err }, 'Error no controlado');
  } else {
    req.log?.warn({ code: apiErr.code, status }, apiErr.message);
  }

  res.status(status).json({
    error: {
      code: apiErr?.code ?? 'INTERNAL_ERROR',
      message: apiErr?.message ?? 'Ocurrió un error inesperado. Intenta de nuevo.',
      ...(apiErr?.details && { details: apiErr.details }),
      requestId: req.id,
      ...(!env.isProd && !apiErr && { debug: err?.message }),
    },
  });
}
