export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string // ISO 8601
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}
