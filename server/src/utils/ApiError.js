/**
 * Error de negocio con un código estable y un mensaje apto para el usuario.
 * Todo lo que no sea ApiError se responde como 500 genérico.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Solicitud inválida', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }
  static validation(details) {
    return new ApiError(422, 'VALIDATION_ERROR', 'Hay datos inválidos', details);
  }
  static unauthorized(message = 'No autenticado') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'No tienes permiso para realizar esta acción') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(resource = 'Recurso') {
    return new ApiError(404, 'NOT_FOUND', `${resource} no encontrado`);
  }
  static conflict(message, details) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
  static locked(message) {
    return new ApiError(423, 'LOCKED', message);
  }
}
