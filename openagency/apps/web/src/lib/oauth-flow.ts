// ─── OAuth Popup Flow ───────────────────────────────────────────────
// Opens a popup window for OAuth, receives code via postMessage.

export interface OAuthResult {
  code: string;
  state?: string;
}

/**
 * Open a popup window for OAuth authorization and wait for the callback.
 * The AuthCallbackPage posts the code back via postMessage.
 */
export function startOAuthPopup(authUrl: string): Promise<OAuthResult | null> {
  return new Promise((resolve) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    if (!popup) {
      resolve(null);
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_callback') {
        window.removeEventListener('message', handleMessage);
        popup.close();
        resolve({
          code: event.data.code,
          state: event.data.state,
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Poll for popup close (user cancelled)
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener('message', handleMessage);
        resolve(null);
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollTimer);
      window.removeEventListener('message', handleMessage);
      if (!popup.closed) popup.close();
      resolve(null);
    }, 300_000);
  });
}
