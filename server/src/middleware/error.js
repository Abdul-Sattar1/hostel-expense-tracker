export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function errorHandler(err, _req, res, _next) {
  // Deliberate HttpErrors keep their status (including 503); anything else is only trusted if it is a 4xx.
  const status = err instanceof HttpError || (err.status >= 400 && err.status < 500) ? err.status : 500;
  if (status === 500) console.error(err);
  const message =
    status === 500 ? 'Something went wrong on our side. Please try again.'
    : err instanceof HttpError ? err.message
    : err.type === 'entity.parse.failed' ? 'Malformed JSON body.'
    : err.type === 'entity.too.large' ? 'Request body is too large.'
    : 'Invalid request.';
  res.status(status).json(err instanceof HttpError && err.errors ? { message, errors: err.errors } : { message });
}
