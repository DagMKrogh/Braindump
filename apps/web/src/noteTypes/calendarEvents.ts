import type { NoteTypeDefinition } from '@braindump/shared'

export const scheduledTaskType: NoteTypeDefinition = {
  id: 'scheduled-task',
  label: 'Scheduled Task',
  icon: 'ClipboardList',
  color: '#4ade80',
  system: true,
  isCalendarEvent: true,
  startTimeField: 'start',
  endTimeField: 'end',
  metadataFields: [
    { key: 'start', label: 'Start', type: 'datetime', required: true },
    { key: 'end', label: 'End', type: 'datetime' },
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high'] },
    { key: 'linkedTaskId', label: 'Linked Task ID', type: 'text' },
  ],
  defaultMetadata: { priority: 'medium' },
  contentTemplate: () => ({ type: 'doc', content: [{ type: 'paragraph' }] }),
}

export const deadlineType: NoteTypeDefinition = {
  id: 'deadline',
  label: 'Deadline',
  icon: 'Flag',
  color: '#fb923c',
  system: true,
  isCalendarEvent: true,
  allDayDefault: true,
  calendarDateField: 'deadline',
  metadataFields: [
    { key: 'deadline', label: 'Deadline', type: 'date', required: true },
    { key: 'severity', label: 'Severity', type: 'select', options: ['soft', 'hard', 'critical'] },
    { key: 'deliverable', label: 'Deliverable', type: 'text' },
    { key: 'project', label: 'Project', type: 'text' },
  ],
  defaultMetadata: { severity: 'hard' },
  searchableMetadataFields: ['deliverable', 'project'],
  contentTemplate: () => ({ type: 'doc', content: [{ type: 'paragraph' }] }),
}

export const focusBlockType: NoteTypeDefinition = {
  id: 'focus-block',
  label: 'Focus Block',
  icon: 'Target',
  color: '#38bdf8',
  system: true,
  isCalendarEvent: true,
  startTimeField: 'start',
  endTimeField: 'end',
  metadataFields: [
    { key: 'start', label: 'Start', type: 'datetime', required: true },
    { key: 'end', label: 'End', type: 'datetime' },
    { key: 'goal', label: 'Goal / Topic', type: 'text' },
    { key: 'doNotDisturb', label: 'Do Not Disturb', type: 'boolean' },
  ],
  defaultMetadata: { doNotDisturb: true },
  contentTemplate: () => ({ type: 'doc', content: [{ type: 'paragraph' }] }),
}

export const onCallShiftType: NoteTypeDefinition = {
  id: 'on-call-shift',
  label: 'On-Call Shift',
  icon: 'Phone',
  color: '#f87171',
  system: true,
  isCalendarEvent: true,
  startTimeField: 'start',
  endTimeField: 'end',
  allDayDefault: true,
  metadataFields: [
    { key: 'start', label: 'Start', type: 'datetime', required: true },
    { key: 'end', label: 'End', type: 'datetime', required: true },
    { key: 'escalationContact', label: 'Escalation Contact', type: 'text' },
    { key: 'runbookLink', label: 'Runbook Link', type: 'text' },
  ],
  defaultMetadata: {},
  contentTemplate: () => ({ type: 'doc', content: [{ type: 'paragraph' }] }),
}

export const releaseDeployType: NoteTypeDefinition = {
  id: 'release-deploy',
  label: 'Release / Deploy',
  icon: 'Rocket',
  color: '#c084fc',
  system: true,
  isCalendarEvent: true,
  calendarDateField: 'datetime',
  metadataFields: [
    { key: 'datetime', label: 'Date & Time', type: 'datetime', required: true },
    { key: 'environment', label: 'Environment', type: 'select', options: ['dev', 'staging', 'prod'] },
    { key: 'version', label: 'Version / Tag', type: 'text', placeholder: 'v1.2.0' },
    { key: 'rollbackPlan', label: 'Rollback Plan', type: 'textarea' },
  ],
  defaultMetadata: { environment: 'prod' },
  searchableMetadataFields: ['version', 'environment'],
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Checklist' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
    ],
  }),
}

export const reviewRetroType: NoteTypeDefinition = {
  id: 'review-retro',
  label: 'Review / Retro',
  icon: 'RotateCcw',
  color: '#fdba74',
  system: true,
  isCalendarEvent: true,
  startTimeField: 'start',
  endTimeField: 'end',
  metadataFields: [
    { key: 'start', label: 'Start', type: 'datetime', required: true },
    { key: 'end', label: 'End', type: 'datetime' },
    { key: 'type', label: 'Type', type: 'select', options: ['review', 'retro', 'postmortem'] },
    { key: 'attendees', label: 'Attendees', type: 'text' },
  ],
  defaultMetadata: { type: 'retro' },
  contentTemplate: () => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'What went well' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'What to improve' }] },
      { type: 'paragraph' },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Action items' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
    ],
  }),
}

export const reminderType: NoteTypeDefinition = {
  id: 'reminder',
  label: 'Reminder',
  icon: 'Bell',
  color: '#fbbf24',
  system: true,
  isCalendarEvent: true,
  calendarDateField: 'datetime',
  metadataFields: [
    { key: 'datetime', label: 'Remind at', type: 'datetime', required: true },
  ],
  defaultMetadata: {},
  contentTemplate: () => ({ type: 'doc', content: [{ type: 'paragraph' }] }),
}
