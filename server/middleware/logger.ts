import morgan from 'morgan'
import type { RequestHandler } from 'express'

/**
 * HTTP request logger middleware.
 *
 * Uses 'dev' format in development (coloured, concise) and 'combined'
 * (Apache Combined Log Format) in production so logs are structured
 * for ingestion by log aggregators.
 */
export const requestLogger: RequestHandler = morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
)
