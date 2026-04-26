import { Helmet } from '@dr.pogodin/react-helmet'
import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '@/components/ui/buttons/Button'
import { Field } from '@/components/ui/forms/Field'
import Input from '@/components/ui/forms/Input'
import Alert from '@/components/ui/feedback/Alert'
import { ROUTES } from '@/constants/routes.constants'
import apiClient from '@/lib/api-client.lib'

/**
 * Forgot Password page — implements better-auth password recovery.
 */
export default function ForgotPasswordPage() {
  const isEmailEnabled = import.meta.env.VITE_EMAIL_SERVICES_ENABLE === 'true'

  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setError('Email is required.')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    setError(null)
    setIsLoading(true)

    // Pre-validate email existence before dispatching the reset link.
    // The /validate/email-reset endpoint is already rate-limited (VALIDATE_LIMIT: 20 req/60s)
    // and returns { valid: false, error } for unknown addresses so we surface a real UX error
    // rather than silently sending to a non-existent account.
    try {
      const check = await apiClient.post<{ valid: boolean; error?: string }>(
        '/api/v1/validate/email-reset',
        { email, adminOnly: false },
      )
      if (!check.data.valid) {
        setError(
          check.data.error ?? 'No account found with this email address.',
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
        adminOnly: false,
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
      <div className="flex items-center justify-center min-h-[80vh] px-6 py-12">
        <Helmet>
          <title>Forgot Password · Cat-Bot</title>
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
    <div className="flex items-center justify-center min-h-[80vh] px-6 py-12">
      <Helmet>
        <title>Forgot Password · Cat-Bot</title>
      </Helmet>

      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-headline-md font-medium text-on-surface font-brand">
            Reset Password
          </h1>
          <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
            Enter your account email to receive a secure password reset link.
          </p>
        </div>

        <div className="rounded-2xl bg-surface shadow-elevation-1 p-8 flex flex-col gap-6">
          {isSubmitted ? (
            <div className="flex flex-col gap-6">
              <Alert
                variant="tonal"
                color="success"
                title="Check your email"
                message={`If ${email} is registered, a recovery link has been sent.`}
              />
              <Button
                as={Link}
                to={ROUTES.LOGIN}
                variant="filled"
                color="primary"
                size="md"
                fullWidth
              >
                Back to log in
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-5"
            >
              <Field.Root invalid={!!error} required>
                <Field.Label>Email</Field.Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
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
                Send reset link
              </Button>
            </form>
          )}
        </div>

        {!isSubmitted && (
          <p className="text-center text-body-md text-on-surface-variant">
            Remember your password?{' '}
            <Button
              as={Link}
              to={ROUTES.LOGIN}
              variant="link"
              color="primary"
              size="md"
            >
              Log in
            </Button>
          </p>
        )}
      </div>
    </div>
  )
}
