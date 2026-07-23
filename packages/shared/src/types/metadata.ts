// Type-specific metadata shapes.
// These are stored in the `metadata` JSONB field on Note.

export interface DailyJotMeta {
  energy?: 'low' | 'medium' | 'high'
}

export interface MeetingMeta {
  start?: string // ISO 8601
  end?: string
  attendees?: string[]
  agenda?: string
  actionItems?: string[]
}

export interface ShortMeetingMeta {
  start?: string
  attendees?: string[]
  actionItems?: string[]
}

export interface TaskMeta {
  dueDate?: string
  priority?: 'low' | 'medium' | 'high'
  status: 'open' | 'in-progress' | 'done' | 'cancelled'
}

export interface CodeSegmentMeta {
  language: string
  source?: string // URL or reference
}

export interface TechDocMeta {
  version?: string
  relatedLinks?: string[]
}

export interface ContactMeta {
  email?: string
  phone?: string
  org?: string
  role?: string
  socialHandles?: Record<string, string>
  lastContacted?: string
}

export interface SecretMeta {
  category?: string
  expiry?: string
}

export interface AppointmentMeta {
  start?: string
  end?: string
  location?: string
  attendees?: string[]
}

export interface AiAgentMeta {
  model?: string
  promptUsed?: string
  qualityRating?: 1 | 2 | 3 | 4 | 5
}

// Calendar event types
export interface ScheduledTaskMeta {
  start: string
  end?: string
  priority?: 'low' | 'medium' | 'high'
  linkedTaskId?: string
}

export interface DeadlineMeta {
  deadline: string
  deliverable?: string
  severity?: 'soft' | 'hard' | 'critical'
  project?: string
}

export interface FocusBlockMeta {
  start: string
  end?: string
  goal?: string
  doNotDisturb?: boolean
}

export interface OnCallShiftMeta {
  start: string
  end: string
  escalationContact?: string
  runbookLink?: string
}

export interface ReleaseDeployMeta {
  datetime: string
  environment?: 'dev' | 'staging' | 'prod'
  version?: string
  rollbackPlan?: string
}

export interface ReviewRetroMeta {
  start: string
  end?: string
  attendees?: string[]
  type?: 'review' | 'retro' | 'postmortem'
  outcomes?: string[]
}

export interface ReminderMeta {
  datetime: string
}
