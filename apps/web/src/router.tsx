import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { TasksPage } from './pages/TasksPage'
import { NotesPage } from './pages/NotesPage'
import { CalendarPage } from './pages/CalendarPage'
import { TagsPage } from './pages/TagsPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { SharePage } from './pages/SharePage'

export const router = createBrowserRouter([
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/share/:slug',
    element: <SharePage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'notes/:id', element: <NotesPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
