import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin, verifySession } from './_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await verifySession(req)
    if (!session.valid) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('profile_stats')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({
      rows: data || [],
      username: session.username
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
}
