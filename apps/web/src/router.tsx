import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { NotesPage } from './pages/NotesPage'
import { CalendarPage } from './pages/CalendarPage'
import { TagsPage } from './pages/TagsPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'

export const router = createBrowserRouter([
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/notes" replace /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'notes/:id', element: <NotesPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
