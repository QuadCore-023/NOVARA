import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  clearSessionCookie,
  createSessionToken,
  getAdminCredentials,
  hashPassword,
  setSessionCookie
} from './_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'DELETE') {
    clearSessionCookie(res)
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { username, password } = req.body || {}
    if (!password) {
      return res.status(400).json({ error: 'Password is required' })
    }

    const creds = await getAdminCredentials()
    const inputUsername = username ? String(username).trim() : creds.username
    const inputHash = hashPassword(String(password))

    if (inputUsername !== creds.username || inputHash !== creds.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = createSessionToken(creds.username, creds.passwordHash)
    setSessionCookie(res, token)

    return res.status(200).json({
      token,
      username: creds.username
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
}
