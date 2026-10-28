import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin, verifySession } from './_auth.js'

const COLUMNS = [
  'id',
  'playerName',
  'deviceId',
  'installedModules',
  'availableQuestions',
  'answeredQuestions',
  'correctAnswers',
  'wrongAnswers',
  'accuracy',
  'masteryRank',
  'sentAtUtc',
  'created_at'
] as const

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

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

    const rows = data || []
    const csvLines = [
      COLUMNS.join(','),
      ...rows.map((row: Record<string, unknown>) =>
        COLUMNS.map((col) => escapeCsvValue(row[col])).join(',')
      )
    ]

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="novara_profile_stats.csv"')
    return res.status(200).send(csvLines.join('\n'))
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
}
