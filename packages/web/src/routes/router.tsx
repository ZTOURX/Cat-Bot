/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ROUTES, ROUTE_SEGMENTS } from '@/constants/routes.constants'

// Layout shells are NOT lazy — they must render immediately so the nav
// chrome appears before any page bundle resolves.
import Layout from '@/components/layout/Layout'
import DashboardLayout from '@/components/layout/DashboardLayout'
import UserProtectedRoute from '@/guards/UserProtectedRoute'
import PublicRoute from '@/guards/PublicRoute'

// Page bundles split per-route so the initial JS payload stays small.
const HomePage = lazy(() => import('@/pages/Home'))
const LoginPage = lazy(() => import('@/pages/Login'))
const SignupPage = lazy(() => import('@/pages/Signup'))
const SettingsPage = lazy(() => import('@/pages/dashboard/settings'))
const BotManagerPage = lazy(() => import('@/pages/dashboard'))
const NewBotPage = lazy(() => import('@/pages/dashboard/create-new-bot'))
const BotPage = lazy(() => import('@/pages/dashboard/bot'))

// Inline 404 — too lightweight to deserve its own chunk.
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-on-surface">
      <h1 className="text-display-sm font-medium">404</h1>
      <p className="text-body-lg text-on-surface-variant">Page not found.</p>
    </div>
  )
}

/**
 * Wraps lazy pages in a Suspense boundary with a blank surface fallback.
 * The blank div matches the body background so there's no flash of white.
 */
const withSuspense = (node: React.ReactElement) => (
  <Suspense
    fallback={<div className="min-h-screen bg-surface-container-lowest" />}
  >
    {node}
  </Suspense>
)

/**
 * Route tree uses two sibling top-level routes so each shell renders
 * independently. Previously /dashboard was nested under Layout, which
 * caused both the public navbar and the dashboard navbar to render on
 * every dashboard route.
 */
export const router = createBrowserRouter([
  // ── Public shell (marketing + auth pages) ──────────────────────────────
  {
    path: ROUTES.HOME,
    element: <Layout />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      // PublicRoute bounces already-authenticated users to /dashboard so
      // login and signup are unreachable mid-session without a manual sign-out.
      {
        element: <PublicRoute />,
        children: [
          { path: ROUTE_SEGMENTS.LOGIN, element: withSuspense(<LoginPage />) },
          {
            path: ROUTE_SEGMENTS.SIGNUP,
            element: withSuspense(<SignupPage />),
          },
        ],
      },
      { path: '*', element: withSuspense(<NotFound />) },
    ],
  },

  // ── Dashboard shell (operator tool) ────────────────────────────────────
  // UserProtectedRoute is a pathless layout route that owns the /dashboard
  // subtree — unauthenticated visitors are redirected to /login with `from`
  // state so the login page can bounce them back after a successful sign-in.
  // DashboardLayout is nested one level below so it never renders at all
  // for unauthenticated requests (no flash of shell before redirect).
  {
    element: <UserProtectedRoute />,
    children: [
      {
        path: ROUTES.DASHBOARD.ROOT,
        element: <DashboardLayout />,
        children: [
          { index: true, element: withSuspense(<BotManagerPage />) },
          {
            path: ROUTE_SEGMENTS.SETTINGS,
            element: withSuspense(<SettingsPage />),
          },
          {
            path: ROUTE_SEGMENTS.CREATE_NEW_BOT,
            element: withSuspense(<NewBotPage />),
          },
          { path: ROUTE_SEGMENTS.BOT, element: withSuspense(<BotPage />) },
        ],
      },
    ],
  },
])
