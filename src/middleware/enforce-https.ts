import { RequestHandler } from 'express';

/**
 * Middleware that redirects HTTP requests to HTTPS in production
 * when the ENFORCE_HTTPS environment variable is set to 'true'.
 */
export function enforceHttps(): RequestHandler {
  return (req, res, next) => {
    if (
      process.env.ENFORCE_HTTPS === 'true' &&
      req.protocol === 'http' &&
      // `x-forwarded-proto` may be set by reverse proxies
      req.get('x-forwarded-proto') !== 'https'
    ) {
      const host = req.get('host');
      const url = `https://${host}${req.originalUrl}`;
      return res.redirect(301, url);
    }
    next();
  };
}
