import type { NoteTypeDefinition } from '@braindump/shared'
import { scratchType } from './scratch'
import { dailyJotType } from './dailyJot'
import { taskType } from './task'
import { meetingType } from './meeting'
import { shortMeetingType } from './shortMeeting'
import { codeSegmentType } from './codeSegment'
import { techDocType } from './techDoc'
import { contactType } from './contact'
import { secretType } from './secret'
import { appointmentType } from './appointment'
import { aiAgentType } from './aiAgent'
import {
  scheduledTaskType,
  deadlineType,
  focusBlockType,
  onCallShiftType,
  releaseDeployType,
  reviewRetroType,
  reminderType,
} from './calendarEvents'

export const builtInTypes: NoteTypeDefinition[] = [
  // General note types
  scratchType,
  dailyJotType,
  taskType,
  codeSegmentType,
  techDocType,
  contactType,
  secretType,
  aiAgentType,
  // Meeting types
  shortMeetingType,
  meetingType,
  // Calendar event types
  appointmentType,
  scheduledTaskType,
  deadlineType,
  focusBlockType,
  onCallShiftType,
  releaseDeployType,
  reviewRetroType,
  reminderType,
]
