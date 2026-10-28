import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export function hashPassword(password: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'novara-secret'
  return crypto.createHmac('sha256', secret).update(password).digest('hex')
}

export async function getAdminCredentials() {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('admin_credentials')
    .select('username, password_hash')
    .eq('id', 1)
    .maybeSingle()

  if (data) {
    return {
      username: data.username,
      passwordHash: data.password_hash
    }
  }

  const defaultUsername = process.env.ADMIN_USERNAME || 'admin'
  const defaultPassword = process.env.ADMIN_PASSWORD || ''
  const defaultHash = hashPassword(defaultPassword)

  await supabase.from('admin_credentials').upsert({
    id: 1,
    username: defaultUsername,
    password_hash: defaultHash,
    updated_at: new Date().toISOString()
  })

  return {
    username: defaultUsername,
    passwordHash: defaultHash
  }
}

export function createSessionToken(username: string, passwordHash: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'novara-secret'
  const payload = Buffer.from(JSON.stringify({ u: username, t: Date.now() })).toString('base64url')
  const sig = crypto.createHmac('sha256', `${secret}:${passwordHash}`).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export async function verifySession(req: VercelRequest): Promise<{ valid: boolean; username?: string }> {
  const authHeader = req.headers.authorization
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const cookieHeader = req.headers.cookie || ''
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)novara_session=([^;]+)/)
  const token = tokenFromHeader || (cookieMatch ? decodeURIComponent(cookieMatch[1]) : undefined)

  if (!token || !token.includes('.')) {
    return { valid: false }
  }

  const [payload, sig] = token.split('.')
  try {
    const creds = await getAdminCredentials()
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'novara-secret'
    const expectedSig = crypto.createHmac('sha256', `${secret}:${creds.passwordHash}`).update(payload).digest('base64url')

    if (sig !== expectedSig) {
      return { valid: false }
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (decoded.u !== creds.username) {
      return { valid: false }
    }

    return { valid: true, username: creds.username }
  } catch {
    return { valid: false }
  }
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const isProd = process.env.NODE_ENV === 'production'
  res.setHeader(
    'Set-Cookie',
    `novara_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${isProd ? '; Secure' : ''}`
  )
}

export function clearSessionCookie(res: VercelResponse) {
  res.setHeader(
    'Set-Cookie',
    'novara_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
  )
}
