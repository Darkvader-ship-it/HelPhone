import express from 'express'
import cors from 'cors'

import { requestLogger } from './middleware/logger.js'
import { generalLimiter } from './middleware/rateLimiter.js'
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js'
import { zkRouter } from './routes/zk.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['https://helphone.com', 'https://staging.helphone.com']

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
)

// ── Global middleware pipeline ────────────────────────────────────────────────
app.use(requestLogger)          // HTTP request logging
app.use(generalLimiter)         // Global rate limiting (100 req/min per IP)
app.use(express.json({ limit: '1mb' }))

// ── Routes ────────────────────────────────────────────────────────────────────

// Legacy health endpoint kept for backward-compat
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// ZK prover routes mounted at /zk
app.use('/zk', zkRouter)

// ── Error handling (must come last) ──────────────────────────────────────────
app.use(notFoundHandler)
app.use(globalErrorHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ZK Prover on http://localhost:${PORT}`)
  // Warm prover in the background — don't block startup
  import('./routes/zk.js')
    .then(() => console.log('[prover] Route module loaded'))
    .catch((err: unknown) =>
      console.error('[prover] Init failed:', err),
    )
})
