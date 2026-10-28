export interface ProfileStat {
  id: number
  playerName: string | null
  deviceId: string | null
  installedModules: number | null
  availableQuestions: number | null
  answeredQuestions: number | null
  correctAnswers: number | null
  wrongAnswers: number | null
  accuracy: number | null
  masteryRank: string | null
  sentAtUtc: string | null
  created_at: string
}

export type SortColumn = keyof Omit<ProfileStat, 'id'>
export type SortDirection = 'asc' | 'desc'
