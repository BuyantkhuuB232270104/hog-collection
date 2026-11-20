class AppError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
const bad = (code, msg, details) => new AppError(400, code, msg, details);
const forbidden = (msg = 'Энэ үйлдлийг хийх эрхгүй байна.') => new AppError(403, 'FORBIDDEN', msg);
const notFound = (msg = 'Олдсонгүй.') => new AppError(404, 'NOT_FOUND', msg);
const conflict = (code, msg, details) => new AppError(409, code, msg, details);
module.exports = { AppError, bad, forbidden, notFound, conflict };
