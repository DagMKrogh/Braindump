function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export const config = {
  port: Number(optional('PORT', '3001')),
  host: optional('HOST', '0.0.0.0'),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtAccessExpiry: optional('JWT_ACCESS_EXPIRY', '1h'),
  jwtRefreshExpiry: optional('JWT_REFRESH_EXPIRY', '30d'),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  googleCallbackUrl: required('GOOGLE_CALLBACK_URL'),
  allowedOrigin: optional('ALLOWED_ORIGIN', 'http://localhost:5173'),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:5173'),
  nodeEnv: optional('NODE_ENV', 'development'),
  ingestApiKey: optional('INGEST_API_KEY', ''),
} as const
