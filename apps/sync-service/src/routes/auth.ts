import crypto from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import oauth2Plugin from '@fastify/oauth2'
import { eq } from 'drizzle-orm'
import { db } from '../plugins/db.js'
import { users, refreshTokens } from '../db/schema.js'
import { config } from '../config.js'

interface GoogleUser {
  id: string
  email: string
  name: string
  picture?: string
}

async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Google user info')
  return res.json() as Promise<GoogleUser>
}

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Buffer.from(buf).toString('hex')
}

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err)
      else resolve(`${salt}:${derived.toString('hex')}`)
    })
  })
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(':') as [string, string]
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err)
      else resolve(derived.toString('hex') === hash)
    })
  })
}

type GoogleOAuth2 = {
  getAccessTokenFromAuthorizationCodeFlow: (req: unknown) => Promise<{ token: { access_token: string } }>
}

const googleEnabled = Boolean(config.googleClientId && config.googleClientSecret && config.googleCallbackUrl)

export const authRoutes: FastifyPluginAsync = async (app) => {
  if (googleEnabled) {
    await app.register(oauth2Plugin, {
      name: 'googleOAuth2',
      scope: ['openid', 'email', 'profile'],
      credentials: {
        client: { id: config.googleClientId, secret: config.googleClientSecret },
        auth: oauth2Plugin.GOOGLE_CONFIGURATION,
      },
      startRedirectPath: '/google',
      callbackUri: config.googleCallbackUrl,
    })

    // GET /auth/google/callback
    app.get('/google/callback', async (request, reply) => {
      const { googleOAuth2 } = app as unknown as { googleOAuth2: GoogleOAuth2 }
      const tokenData = await googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)
      const googleUser = await fetchGoogleUser(tokenData.token.access_token)

      // Upsert user
      const existing = await db.query.users.findFirst({ where: eq(users.googleId, googleUser.id) })
      let userId: string
      if (existing) {
        await db.update(users)
          .set({ name: googleUser.name, avatarUrl: googleUser.picture ?? null, updatedAt: new Date() })
          .where(eq(users.id, existing.id))
        userId = existing.id
      } else {
        const [created] = await db.insert(users).values({
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.picture ?? null,
          googleId: googleUser.id,
        }).returning({ id: users.id })
        userId = created!.id
      }

      // Issue access token (short-lived)
      const accessToken = app.jwt.sign(
        { sub: userId, email: googleUser.email },
        { expiresIn: config.jwtAccessExpiry }
      )

      // Issue + store refresh token
      const refreshToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`
      const tokenHash = await hashToken(refreshToken)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt })

      // Redirect to frontend with tokens in hash (consumed by AuthCallbackPage)
      const userParam = encodeURIComponent(JSON.stringify({ id: userId, email: googleUser.email, name: googleUser.name, avatarUrl: googleUser.picture ?? null }))
      return reply.redirect(`${config.frontendUrl}/auth/callback#token=${accessToken}&refreshToken=${refreshToken}&user=${userParam}`)
    })
  } else {
    app.get('/google', async (_request, reply) => {
      return reply.status(503).send({ error: 'Google OAuth is not configured on this server' })
    })
    app.get('/google/callback', async (_request, reply) => {
      return reply.status(503).send({ error: 'Google OAuth is not configured on this server' })
    })
  }

  // POST /auth/refresh
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }
    if (!refreshToken) return reply.status(400).send({ error: 'Missing refreshToken' })

    const tokenHash = await hashToken(refreshToken)
    const record = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, tokenHash) })

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' })
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, record.userId) })
    if (!user) return reply.status(401).send({ error: 'User not found' })

    // Rotate: revoke old, issue new
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, record.id))
    const newRefreshToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`
    const newHash = await hashToken(newRefreshToken)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db.insert(refreshTokens).values({ userId: user.id, tokenHash: newHash, expiresAt })

    const accessToken = app.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: config.jwtAccessExpiry }
    )
    return { accessToken, refreshToken: newRefreshToken, expiresIn: 3600 }
  })

  // GET /auth/me
  app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    const user = await db.query.users.findFirst({ where: eq(users.id, sub) })
    if (!user) throw new Error('User not found')
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }
  })

  // POST /auth/register — create a local (non-Google) user
  app.post('/register', async (request, reply) => {
    const { email, name, password } = request.body as { email: string; name: string; password: string }
    if (!email || !name || !password) {
      return reply.status(400).send({ error: 'email, name and password are required' })
    }
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (existing) return reply.status(409).send({ error: 'Email already registered' })

    const passwordHash = await hashPassword(password)
    const [user] = await db.insert(users).values({ email, name, passwordHash }).returning()

    const { accessToken, refreshToken } = await issueTokens(app, user!.id, email)
    return reply.status(201).send({
      accessToken,
      refreshToken,
      user: { id: user!.id, email: user!.email, name: user!.name, avatarUrl: null },
    })
  })

  // POST /auth/login — local password login
  app.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }
    if (!email || !password) return reply.status(400).send({ error: 'email and password are required' })

    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!user || !user.passwordHash) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    const { accessToken, refreshToken } = await issueTokens(app, user.id, email)
    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    })
  })

  // GET /auth/users — list all users (for profile picker; local network only)
  app.get('/users', async () => {
    return db.select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
  })
}

async function issueTokens(app: { jwt: { sign: (payload: object, opts: object) => string } }, userId: string, email: string) {
  const accessToken = app.jwt.sign(
    { sub: userId, email },
    { expiresIn: config.jwtAccessExpiry }
  )
  const refreshToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`
  const tokenHash = await hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt })
  return { accessToken, refreshToken }
}
