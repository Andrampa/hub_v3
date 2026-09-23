// Drops the credential the account-creation redirect leaves in the fragment.
// A separate file rather than an inline script, so a host CSP of script-src
// 'self' does not have to allow inline script for this one page.
if (window.location.hash) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}
