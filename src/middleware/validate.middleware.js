const { ZodError } = require('zod');

// Generic validation middleware to parse request body, query, or params against a Zod schema
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      // Parse and replace request data with sanitized Zod output
      req[source] = schema.parse(req[source]);
      next();
    } catch (error) {
      // Format Zod validation errors into a clean JSON error response
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};

module.exports = validate;
