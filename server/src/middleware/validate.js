// Validates the JSON body (default) or the query string. Express 5 query objects are read-only,
// so the parsed query is exposed as req.filter.
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) errors[issue.path[0] ?? 'form'] ??= issue.message;
    return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });
  }
  if (source === 'body') req.body = result.data;
  else req.filter = result.data;
  next();
};
