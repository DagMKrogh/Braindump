import type { NoteTypeDefinition } from '@braindump/shared'
import { scratchType } from './scratch'
import { dailyJotType } from './dailyJot'
import { taskType } from './task'
import { meetingType } from './meeting'
import { codeSegmentType } from './codeSegment'
import { techDocType } from './techDoc'
// Remaining types added in subsequent tasks:
// shortMeeting, contact, secret, appointment, aiAgent
// Calendar event types: scheduledTask, deadline, focusBlock, onCallShift, releaseDeploy, reviewRetro, reminder

export const builtInTypes: NoteTypeDefinition[] = [
  scratchType,
  dailyJotType,
  taskType,
  meetingType,
  codeSegmentType,
  techDocType,
]

export {
  scratchType,
  dailyJotType,
  taskType,
  meetingType,
  codeSegmentType,
  techDocType,
}
