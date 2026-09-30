export type RoleCode = 'PM' | 'SPM'

export interface Criterion {
  id: number
  role_code: RoleCode
  sort: number
  name: string
  description: string
  weight: number
}

export interface Settings {
  threshold: number
  topN: number
  scoringNotes: string
}

export interface Candidate {
  id: string
  applied_role: RoleCode
  filename: string | null
  cv_path: string | null
  cv_text: string
  status: 'processing' | 'ready' | 'error'
  error: string | null
  score_pm: number | null
  score_spm: number | null
  brief: string | null
  email_kind: 'invite' | 'reject' | null
  email_subject: string | null
  email_body: string | null
  email_status: 'draft' | 'sending' | 'sent'
  email_to: string | null
  email_error: string | null
  resend_id: string | null
  sent_at: string | null
  created_at: string
}

export interface CandidatePii {
  candidate_id: string
  name: string | null
  email: string | null
  phone: string | null
}

export interface ScoreRow {
  candidate_id: string
  criterion_id: number
  score: number
  reason: string
}

export const roleTitle = (r: RoleCode) => (r === 'PM' ? 'Product Manager' : 'Senior Product Manager')
export const appliedScore = (c: Candidate) => (c.applied_role === 'PM' ? c.score_pm : c.score_spm)
