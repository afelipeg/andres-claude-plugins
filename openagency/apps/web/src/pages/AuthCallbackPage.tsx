// ─── OAuth Callback Page ────────────────────────────────────────────
// Receives the OAuth code from the popup window and posts it back
// to the parent window via postMessage.

import { useEffect, useState } from 'react';

export function AuthCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      return;
    }

    if (code && window.opener) {
      window.opener.postMessage(
        { type: 'oauth_callback', code, state },
        window.location.origin,
      );
      setStatus('success');
      // Auto-close after a short delay
      setTimeout(() => window.close(), 1500);
    } else {
      setStatus('error');
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-xl bg-white p-8 shadow-lg text-center max-w-sm">
        {status === 'processing' && (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
            <p className="text-sm text-gray-600">Processing authorization...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">Authorization successful!</p>
            <p className="mt-1 text-xs text-gray-500">This window will close automatically.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">Authorization failed</p>
            <p className="mt-1 text-xs text-gray-500">Please close this window and try again.</p>
          </>
        )}
      </div>
    </div>
  );
}
