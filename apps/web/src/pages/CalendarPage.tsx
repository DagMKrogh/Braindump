import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LocalNote, NoteTypeDefinition } from '@braindump/shared'
import { getAllNotes } from '../lib/localStore'
import { getType } from '../lib/noteTypeRegistry'
import s from '../styles/layout.module.css'

type ViewMode = 'month' | 'week' | 'day'

interface CalEvent {
  note: LocalNote
  typeDef: NoteTypeDefinition
  start: Date
  end: Date
  isAllDay: boolean
}

const HOUR_H = 56 // px per hour in time grid
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const TIME_COL = 52 // px for time label column

// ---- Date helpers ----
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function startOfWeek(d: Date) {
  const day = d.getDay()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day === 0 ? 6 : day - 1))
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function dayKey(d: Date) { return d.toISOString().slice(0, 10) }

// ---- Event parsing ----
function getMetaStr(meta: Record<string, unknown>, field: string | undefined): string | null {
  if (!field) return null
  const v = meta[field]
  return typeof v === 'string' && v ? v : null
}

function parseEvent(note: LocalNote): { start: Date; end: Date; isAllDay: boolean } | null {
  const typeDef = getType(note.type)
  if (!typeDef?.isCalendarEvent) return null
  const meta = note.metadata as Record<string, unknown>
  let isAllDay = typeDef.allDayDefault ?? false

  let startStr = getMetaStr(meta, typeDef.startTimeField)
  if (!startStr) {
    startStr = getMetaStr(meta, typeDef.calendarDateField)
    if (startStr && !startStr.includes('T')) isAllDay = true
  }
  if (!startStr) return null

  const start = new Date(startStr)
  const endStr = getMetaStr(meta, typeDef.endTimeField)
  const defaultMs = isAllDay ? 0 : 60 * 60 * 1000
  const end = endStr ? new Date(endStr) : new Date(start.getTime() + defaultMs)
  return { start, end, isAllDay }
}

// ---- Main page ----
export function CalendarPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(new Date())
  const [allNotes, setAllNotes] = useState<LocalNote[]>([])

  useEffect(() => { getAllNotes().then(setAllNotes) }, [])

  const events = useMemo<CalEvent[]>(() => {
    const result: CalEvent[] = []
    for (const note of allNotes) {
      const typeDef = getType(note.type)
      if (!typeDef?.isCalendarEvent) continue
      const parsed = parseEvent(note)
      if (!parsed) continue
      result.push({ note, typeDef, ...parsed })
    }
    return result.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [allNotes])

  // Non-event notes that have a dateRef — shown as dot markers in month view
  const dateRefNotes = useMemo<LocalNote[]>(() =>
    allNotes.filter((n) => n.dateRef && !getType(n.type)?.isCalendarEvent),
  [allNotes])

  const today = useMemo(() => new Date(), [])

  function moveCursor(delta: number) {
    if (view === 'month') setCursor(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
    else if (view === 'week') setCursor(d => addDays(d, delta * 7))
    else setCursor(d => addDays(d, delta))
  }

  function headerLabel() {
    if (view === 'month') return cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })
    if (view === 'week') {
      const ws = startOfWeek(cursor)
      const we = addDays(ws, 6)
      return `${ws.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return cursor.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const goToNote = (id: string) => navigate(`/notes/${id}`)
  const goToDay = (d: Date) => { setCursor(d); setView('day') }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <button className={`${s.btn} ${s.btnGhost} ${s.btnIcon}`} onClick={() => moveCursor(-1)}>
          <ChevronLeft size={16} />
        </button>
        <button className={`${s.btn} ${s.btnGhost} ${s.btnIcon}`} onClick={() => moveCursor(1)}>
          <ChevronRight size={16} />
        </button>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', minWidth: 220, userSelect: 'none' }}>
          {headerLabel()}
        </span>
        <button className={`${s.btn} ${s.btnGhost}`} style={{ fontSize: '0.8rem' }} onClick={() => setCursor(new Date())}>
          Today
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: 2 }}>
          {(['month', 'week', 'day'] as const).map(v => (
            <button
              key={v}
              className={s.btn}
              style={{
                background: view === v ? 'var(--color-surface-2)' : 'transparent',
                color: view === v ? 'var(--color-text)' : 'var(--color-text-muted)',
                padding: '0.25rem 0.6rem', fontSize: '0.8rem',
              }}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'month' && <MonthView cursor={cursor} events={events} dateRefNotes={dateRefNotes} today={today} onDayClick={goToDay} onEventClick={goToNote} />}
        {view === 'week' && <TimeGrid days={weekDays} events={events} today={today} onEventClick={goToNote} />}
        {view === 'day' && <TimeGrid days={[cursor]} events={events} today={today} onEventClick={goToNote} />}
      </div>
    </div>
  )
}

// ---- Month View ----
function MonthView({ cursor, events, dateRefNotes, today, onDayClick, onEventClick }: Readonly<{
  cursor: Date; events: CalEvent[]; dateRefNotes: LocalNote[]; today: Date
  onDayClick: (d: Date) => void; onEventClick: (id: string) => void
}>) {
  const gridStart = startOfWeek(startOfMonth(cursor))
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {WEEK_DAYS.map(d => (
          <div key={d} style={{ padding: '0.4rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateRows: 'repeat(6, 1fr)', overflow: 'hidden' }}>
        {weeks.map(week => (
          <div key={dayKey(week[0]!)} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
            {week.map((day, di) => (
              <MonthDayCell
                key={dayKey(day)}
                day={day}
                hasBorderRight={di < 6}
                cursor={cursor}
                events={events}
                dateRefNotes={dateRefNotes}
                today={today}
                onDayClick={onDayClick}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthDayCell({ day, hasBorderRight, cursor, events, dateRefNotes, today, onDayClick, onEventClick }: Readonly<{
  day: Date; hasBorderRight: boolean; cursor: Date; events: CalEvent[]; dateRefNotes: LocalNote[]; today: Date
  onDayClick: (d: Date) => void; onEventClick: (id: string) => void
}>) {
  const isToday = sameDay(day, today)
  const inMonth = day.getMonth() === cursor.getMonth()
  const dayEvents = events.filter(e => sameDay(e.start, day))
  const dayDateRefNotes = dateRefNotes.filter(n => n.dateRef && sameDay(new Date(n.dateRef), day))
  let dayNumberColor: string
  if (isToday) dayNumberColor = '#fff'
  else if (inMonth) dayNumberColor = 'var(--color-text)'
  else dayNumberColor = 'var(--color-text-muted)'

  return (
    <button
      onClick={() => onDayClick(day)}
      style={{
        borderRight: hasBorderRight ? '1px solid var(--color-border)' : 'none',
        borderTop: 'none', borderLeft: 'none', borderBottom: 'none',
        padding: '0.3rem 0.35rem', textAlign: 'left',
        background: 'none', cursor: 'pointer', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: '0.15rem',
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: '50%', fontSize: '0.75rem',
        fontWeight: isToday ? 700 : 400,
        background: isToday ? 'var(--color-accent)' : 'transparent',
        color: dayNumberColor, flexShrink: 0,
      }}>
        {day.getDate()}
      </span>
      {dayEvents.slice(0, 3).map(ev => (
        <MonthEventPill
          key={ev.note.id}
          event={ev}
          onClick={e => { e.stopPropagation(); onEventClick(ev.note.id) }}
        />
      ))}
      {dayEvents.length > 3 && (
        <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', paddingLeft: '0.15rem' }}>
          +{dayEvents.length - 3} more
        </span>
      )}
      {/* dateRef dot markers for non-event notes */}
      {dayDateRefNotes.length > 0 && (
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', paddingLeft: '0.15rem', marginTop: 1 }}>
          {dayDateRefNotes.slice(0, 5).map(n => {
            const typeDef = getType(n.type)
            return (
              <span
                key={n.id}
                title={n.title || 'Untitled'}
                style={{ width: 5, height: 5, borderRadius: '50%', background: typeDef?.color ?? '#6366f1', flexShrink: 0 }}
              />
            )
          })}
          {dayDateRefNotes.length > 5 && (
            <span style={{ fontSize: '0.5rem', color: 'var(--color-text-muted)', lineHeight: '5px' }}>+{dayDateRefNotes.length - 5}</span>
          )}
        </div>
      )}
    </button>
  )
}

function MonthEventPill({ event, onClick }: Readonly<{ event: CalEvent; onClick: React.MouseEventHandler }>) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: `${event.typeDef.color}22`,
        borderLeft: `2px solid ${event.typeDef.color}`,
        borderTop: 'none', borderRight: 'none', borderBottom: 'none',
        borderRadius: 3, padding: '0.05rem 0.25rem',
        fontSize: '0.65rem', color: 'var(--color-text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}
    >
      {!event.isAllDay && (
        <span style={{ color: event.typeDef.color, marginRight: '0.2rem', fontWeight: 600 }}>
          {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {event.note.title || 'Untitled'}
    </button>
  )
}

// ---- Shared Time Grid (week + day) ----
function TimeGrid({ days, events, today, onEventClick }: Readonly<{
  days: Date[]; events: CalEvent[]; today: Date; onEventClick: (id: string) => void
}>) {
  const allDayEvs = events.filter(e => e.isAllDay && days.some(d => sameDay(d, e.start)))
  const timedEvs = events.filter(e => !e.isAllDay && days.some(d => sameDay(d, e.start)))
  const hasAllDay = allDayEvs.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Column headers */}
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ width: TIME_COL, flexShrink: 0 }} />
        {days.map(day => <TimeGridDayHeader key={dayKey(day)} day={day} today={today} />)}
      </div>

      {/* All-day strip */}
      {hasAllDay && (
        <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--color-border)', minHeight: 32 }}>
          <div style={{ width: TIME_COL, flexShrink: 0, fontSize: '0.6rem', color: 'var(--color-text-muted)', padding: '0.5rem 0.4rem 0', textAlign: 'right' }}>
            all-day
          </div>
          {days.map(day => (
            <div key={dayKey(day)} style={{ flex: 1, borderLeft: '1px solid var(--color-border)', padding: '0.2rem 0.25rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {allDayEvs.filter(e => sameDay(e.start, day)).map(ev => (
                <MonthEventPill key={ev.note.id} event={ev} onClick={() => onEventClick(ev.note.id)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ position: 'relative', height: `${24 * HOUR_H}px` }}>
          {/* Hour lines */}
          {HOURS.map(h => (
            <div key={h} style={{ position: 'absolute', top: h * HOUR_H, left: 0, right: 0, display: 'flex' }}>
              <div style={{ width: TIME_COL, flexShrink: 0, fontSize: '0.6rem', color: 'var(--color-text-muted)', textAlign: 'right', paddingRight: '0.4rem', marginTop: -8, lineHeight: 1 }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
              <div style={{ flex: 1, borderTop: '1px solid var(--color-border)', height: HOUR_H }} />
            </div>
          ))}

          {/* Day columns */}
          <div style={{ position: 'absolute', top: 0, left: TIME_COL, right: 0, bottom: 0, display: 'flex' }}>
            {days.map(day => (
              <TimeGridDayColumn key={dayKey(day)} day={day} events={timedEvs} onEventClick={onEventClick} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimeGridDayHeader({ day, today }: Readonly<{ day: Date; today: Date }>) {
  const isToday = sameDay(day, today)
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem 0.25rem', borderLeft: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {day.toLocaleDateString([], { weekday: 'short' })}
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: '50%', fontSize: '0.875rem', fontWeight: 600,
        background: isToday ? 'var(--color-accent)' : 'transparent',
        color: isToday ? '#fff' : 'var(--color-text)',
      }}>
        {day.getDate()}
      </div>
    </div>
  )
}

function TimeGridDayColumn({ day, events, onEventClick }: Readonly<{
  day: Date; events: CalEvent[]; onEventClick: (id: string) => void
}>) {
  const dayEvents = events.filter(e => sameDay(e.start, day))
  return (
    <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid var(--color-border)' }}>
      {dayEvents.map(ev => {
        const startH = ev.start.getHours() + ev.start.getMinutes() / 60
        const endH = ev.end.getHours() + ev.end.getMinutes() / 60
        const top = startH * HOUR_H
        const height = Math.max((endH - startH) * HOUR_H, 22)
        return (
          <button
            key={ev.note.id}
            onClick={() => onEventClick(ev.note.id)}
            style={{
              position: 'absolute', left: 3, right: 3, top, height,
              background: `${ev.typeDef.color}22`,
              borderLeft: `3px solid ${ev.typeDef.color}`,
              borderTop: 'none', borderRight: 'none', borderBottom: 'none',
              borderRadius: 4, padding: '0.15rem 0.3rem',
              fontSize: '0.7rem', color: 'var(--color-text)',
              cursor: 'pointer', textAlign: 'left', overflow: 'hidden', zIndex: 1,
            }}
          >
            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ev.note.title || 'Untitled'}
            </div>
            {height > 32 && (
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>
                {ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {ev.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
