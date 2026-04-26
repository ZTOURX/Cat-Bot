import { Helmet } from '@dr.pogodin/react-helmet'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/buttons/Button'
import { Field } from '@/components/ui/forms/Field'
import Input from '@/components/ui/forms/Input'
import Alert from '@/components/ui/feedback/Alert'
import { ROUTES } from '@/constants/routes.constants'
import apiClient from '@/lib/api-client.lib'

/**
 * Admin Forgot Password page — replicates the user flow but maintains the strictly internal,
 * minimal aesthetic of the admin portal routing boundaries.
 */
export default function AdminForgotPasswordPage() {
  const isEmailEnabled = import.meta.env.VITE_EMAIL_SERVICES_ENABLE === 'true'

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setError('Admin email is required.')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    setError(null)
    setIsLoading(true)

    // Pre-validate email existence with adminOnly: true so non-admin accounts receive a
    // specific "no admin account" error instead of silently queuing a reset for the wrong role.
    // The server checks both email existence AND role === 'admin' in a single query.
    try {
      const check = await apiClient.post<{ valid: boolean; error?: string }>(
        '/api/v1/validate/email-reset',
        { email, adminOnly: true },
      )
      if (!check.data.valid) {
        setError(
          check.data.error ?? 'No admin account found with this email address.',
        )
        setIsLoading(false)
        return
      }
    } catch {
      // Network/server error — fall through and let the reset request attempt proceed
    }

    try {
      await apiClient.post('/api/v1/validate/reset-password/request', {
        email,
        adminOnly: true,
      })
      setIsSubmitted(true)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Failed to send reset link.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isEmailEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-high px-4 py-12">
        <Helmet>
          <title>Admin Recovery · Cat-Bot</title>
        </Helmet>
        <Alert
          color="warning"
          title="Disabled"
          message="Email services are disabled on this instance."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-high px-4 py-12">
      <Helmet>
        <title>Admin Recovery · Cat-Bot</title>
      </Helmet>

      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/10 text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </span>
          <div>
            <h1 className="text-headline-sm font-semibold text-on-surface">
              Account Recovery
            </h1>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Request a secure reset link for your admin account.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface shadow-elevation-1 p-6 flex flex-col gap-5">
          {isSubmitted ? (
            <div className="flex flex-col gap-5">
              <Alert
                variant="tonal"
                color="success"
                title="Request Processed"
                message={`Instructions have been sent to ${email} if an admin record exists.`}
              />
              <Button
                as={Link}
                to={ROUTES.ADMIN.ROOT}
                variant="filled"
                color="primary"
                size="md"
                fullWidth
              >
                Return to Admin Login
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-4"
            >
              <Field.Root invalid={!!error} required>
                <Field.Label>Admin Email</Field.Label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  autoComplete="email"
                />
                <Field.ErrorText>{error}</Field.ErrorText>
              </Field.Root>

              <Button
                type="submit"
                variant="filled"
                color="primary"
                size="md"
                fullWidth
                isLoading={isLoading}
              >
                Send secure link
              </Button>
            </form>
          )}
        </div>

        {!isSubmitted && (
          <p className="text-center text-body-sm text-on-surface-variant">
            <Link
              to={ROUTES.ADMIN.ROOT}
              className="text-primary hover:underline"
            >
              Cancel and return to login
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
