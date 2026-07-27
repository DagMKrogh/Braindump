function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback
}

export const config = {
  port: Number(optional('PORT', '3001')),
  host: optional('HOST', '0.0.0.0'),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtAccessExpiry: optional('JWT_ACCESS_EXPIRY', '1h'),
  jwtRefreshExpiry: optional('JWT_REFRESH_EXPIRY', '30d'),
  googleClientId: optional('GOOGLE_CLIENT_ID', ''),
  googleClientSecret: optional('GOOGLE_CLIENT_SECRET', ''),
  googleCallbackUrl: optional('GOOGLE_CALLBACK_URL', ''),
  allowedOrigins: optional('ALLOWED_ORIGIN', 'http://localhost:5173').split(',').map(s => s.trim()),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:5173'),
  nodeEnv: optional('NODE_ENV', 'development'),
  ingestApiKey: optional('INGEST_API_KEY', ''),
} as const
