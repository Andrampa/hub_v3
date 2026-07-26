import { completeOAuthSignIn } from './services/auth'

completeOAuthSignIn().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown authentication error'
  const status = document.getElementById('oauth-status')
  if (status) status.textContent = `Sign-in could not be completed: ${message}`
})
