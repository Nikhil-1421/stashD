import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/guards'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'

/**
 * Every page is a lazy route module so the initial bundle holds only the shell, auth guards and
 * providers; a section's code loads on first navigation (the shell shows a progress bar meanwhile).
 */
const page = <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) => () => load().then((m) => ({ Component: m[name] as React.ComponentType }))

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', lazy: page(() => import('@/features/auth/LoginPage'), 'LoginPage') },
          { path: '/register', lazy: page(() => import('@/features/auth/RegisterPage'), 'RegisterPage') },
          { path: '/forgot-password', lazy: page(() => import('@/features/auth/ForgotPasswordPage'), 'ForgotPasswordPage') },
        ],
      },
      // These must work whether or not a session exists (the link itself creates one).
      { path: '/check-email', lazy: page(() => import('@/features/auth/CheckEmailPage'), 'CheckEmailPage') },
      { path: '/reset-password', lazy: page(() => import('@/features/auth/ResetPasswordPage'), 'ResetPasswordPage') },
      { path: '/auth/callback', lazy: page(() => import('@/features/auth/AuthCallbackPage'), 'AuthCallbackPage') },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, lazy: page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage') },
              { path: '/settings', lazy: page(() => import('@/features/profile/SettingsPage'), 'SettingsPage') },
              { path: '/more', lazy: page(() => import('@/pages/MorePage'), 'MorePage') },
              { path: '/sets', lazy: page(() => import('@/features/sets/CollectionsPage'), 'CollectionsPage') },
              { path: '/sets/new', lazy: page(() => import('@/features/sets/SetFormPage'), 'SetFormPage') },
              { path: '/sets/:userSetId', lazy: page(() => import('@/features/sets/SetDetailPage'), 'SetDetailPage') },
              { path: '/sets/:userSetId/edit', lazy: page(() => import('@/features/sets/SetFormPage'), 'SetFormPage') },
              { path: '/sets/:userSetId/import', lazy: page(() => import('@/features/import/ImportPage'), 'ImportPage') },
              { path: '/sets/:userSetId/bubble', lazy: page(() => import('@/features/bubble/BubbleCheckPage'), 'BubbleCheckPage') },
              { path: '/binders', lazy: page(() => import('@/features/binders/BindersPage'), 'BindersPage') },
              { path: '/binders/:binderId', lazy: page(() => import('@/features/binders/BinderPage'), 'BinderPage') },
              { path: '/bubble-check', lazy: page(() => import('@/features/bubble/BubbleSetPickerPage'), 'BubbleSetPickerPage') },
              { path: '/wishlist', lazy: page(() => import('@/pages/PlannedPage'), 'PlannedPage') },
              { path: '/trade', lazy: page(() => import('@/pages/PlannedPage'), 'PlannedPage') },
              { path: '/checklists', lazy: page(() => import('@/pages/PlannedPage'), 'PlannedPage') },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
