import express from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Create middleware that validates and sanitizes request bodies using a Zod schema.
 * The parsed result replaces `req.body` if validation succeeds.
 *
 * @param schema - Zod schema to apply to the request body
 * @returns Express middleware that validates the body
 */
export function validateBody(schema: AnyZodObject): express.RequestHandler {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      const zErr = err as ZodError;
      res.status(400).json({ error: 'Invalid request body', details: zErr.errors });
    }
  };
}
