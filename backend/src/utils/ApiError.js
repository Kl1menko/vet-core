/**
 * Уніфікована помилка API. Формат відповіді — ТЗ §10.
 */
export class ApiError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  static badRequest(message = 'Невірний запит', fields = null) {
    return new ApiError(400, 'BAD_REQUEST', message, fields);
  }

  static validation(message = 'Помилка валідації', fields = null) {
    return new ApiError(422, 'VALIDATION_ERROR', message, fields);
  }

  static unauthorized(message = 'Не авторизовано') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Недостатньо прав') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Не знайдено') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Конфлікт даних') {
    return new ApiError(409, 'CONFLICT', message);
  }
}
