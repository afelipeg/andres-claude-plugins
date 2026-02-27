// ─── Generic OAuth2 Client ──────────────────────────────────────────
// Handles auth URL generation, code exchange, and token refresh.
// Platform connectors configure this with their specific endpoints.

export interface OAuth2Config {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  /** Some APIs (TikTok) use JSON body instead of form-encoded for token exchange */
  useJsonBody?: boolean;
}

export interface OAuth2Tokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

export class OAuth2Client {
  constructor(private config: OAuth2Config) {}

  /**
   * Build the authorization URL the user should be redirected to.
   */
  getAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: this.config.scopes.join(' '),
      ...(state ? { state } : {}),
      ...(this.config.extraAuthParams ?? {}),
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for access + refresh tokens.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<OAuth2Tokens> {
    const body: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    };

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: this.config.useJsonBody
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: this.config.useJsonBody
        ? JSON.stringify(body)
        : new URLSearchParams(body).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OAuth2 token exchange failed (${res.status}): ${err}`);
    }

    return (await res.json()) as OAuth2Tokens;
  }

  /**
   * Refresh an expired access token using the refresh token.
   */
  async refreshToken(refreshToken: string): Promise<OAuth2Tokens> {
    const body: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    };

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: this.config.useJsonBody
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: this.config.useJsonBody
        ? JSON.stringify(body)
        : new URLSearchParams(body).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OAuth2 token refresh failed (${res.status}): ${err}`);
    }

    return (await res.json()) as OAuth2Tokens;
  }
}
