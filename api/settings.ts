import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createSessionToken,
  getAdminCredentials,
  getSupabaseAdmin,
  hashPassword,
  setSessionCookie,
  verifySession
} from './_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const session = await verifySession(req)
    if (!session.valid) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'GET') {
      return res.status(200).json({ username: session.username })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { currentPassword, newUsername, newPassword } = req.body || {}
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' })
    }

    const creds = await getAdminCredentials()
    if (hashPassword(String(currentPassword)) !== creds.passwordHash) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const updatedUsername = newUsername ? String(newUsername).trim() : creds.username
    const updatedPasswordHash = newPassword ? hashPassword(String(newPassword)) : creds.passwordHash

    if (!updatedUsername) {
      return res.status(400).json({ error: 'Username cannot be empty' })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('admin_credentials').upsert({
      id: 1,
      username: updatedUsername,
      password_hash: updatedPasswordHash,
      updated_at: new Date().toISOString()
    })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    const token = createSessionToken(updatedUsername, updatedPasswordHash)
    setSessionCookie(res, token)

    return res.status(200).json({
      token,
      username: updatedUsername
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
}
