import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage'
import { BinderPage } from '@/features/binders/BinderPage'
import { BindersPage } from '@/features/binders/BindersPage'
import { BubbleCheckPage } from '@/features/bubble/BubbleCheckPage'
import { BubbleSetPickerPage } from '@/features/bubble/BubbleSetPickerPage'
import { CheckEmailPage } from '@/features/auth/CheckEmailPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ImportPage } from '@/features/import/ImportPage'
import { SettingsPage } from '@/features/profile/SettingsPage'
import { CollectionsPage } from '@/features/sets/CollectionsPage'
import { SetDetailPage } from '@/features/sets/SetDetailPage'
import { SetFormPage } from '@/features/sets/SetFormPage'
import { MorePage } from '@/pages/MorePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlannedPage } from '@/pages/PlannedPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      // These must work whether or not a session exists (the link itself creates one).
      { path: '/check-email', element: <CheckEmailPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '/more', element: <MorePage /> },
              { path: '/sets', element: <CollectionsPage /> },
              { path: '/sets/new', element: <SetFormPage /> },
              { path: '/sets/:userSetId', element: <SetDetailPage /> },
              { path: '/sets/:userSetId/edit', element: <SetFormPage /> },
              { path: '/sets/:userSetId/import', element: <ImportPage /> },
              { path: '/sets/:userSetId/bubble', element: <BubbleCheckPage /> },
              { path: '/binders', element: <BindersPage /> },
              { path: '/binders/:binderId', element: <BinderPage /> },
              { path: '/bubble-check', element: <BubbleSetPickerPage /> },
              { path: '/wishlist', element: <PlannedPage /> },
              { path: '/trade', element: <PlannedPage /> },
              { path: '/checklists', element: <PlannedPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
