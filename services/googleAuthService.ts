import type { GoogleAuthState, GoogleUser } from '../types';

const GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid';
const GOOGLE_ACCESS_TOKEN_KEY = 'google_access_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'google_token_expiry';
const GOOGLE_REFRESH_TOKEN_KEY = 'google_refresh_token';
const GOOGLE_CODE_VERIFIER_KEY = 'google_code_verifier';

function base64URLEncode(str: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await window.crypto.subtle.digest('SHA-256', data);
}

function randomString(length: number): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array).map(b => ('0' + b.toString(16)).slice(-2)).join('');
}

export class GoogleAuthService {
  private accessToken: string | null = null;
  private tokenExpiryTime: number | null = null;
  private refreshToken: string | null = null;
  private googleClientId?: string;
  private onAuthStateChangedCallback: ((state: GoogleAuthState) => void) | null = null;

  constructor(clientId?: string) {
    this.googleClientId = clientId;
    this.tryRestoreSession();
    this.handleRedirect();
  }

  private notifyAuthStateChange(state: GoogleAuthState): void {
    if (this.onAuthStateChangedCallback) {
      this.onAuthStateChangedCallback(state);
    }
  }

  private saveTokens(accessToken: string, expiresIn: number, refreshToken?: string) {
    this.accessToken = accessToken;
    this.tokenExpiryTime = Date.now() + expiresIn * 1000;
    localStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, this.tokenExpiryTime.toString());
    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem(GOOGLE_REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  private clearTokens() {
    this.accessToken = null;
    this.tokenExpiryTime = null;
    this.refreshToken = null;
    localStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(GOOGLE_REFRESH_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_CODE_VERIFIER_KEY);
  }

  private tryRestoreSession() {
    const token = localStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY);
    const expiry = localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);
    const refresh = localStorage.getItem(GOOGLE_REFRESH_TOKEN_KEY);
    if (token && expiry && parseInt(expiry, 10) > Date.now()) {
      this.accessToken = token;
      this.tokenExpiryTime = parseInt(expiry, 10);
      this.refreshToken = refresh || null;
      this.fetchUserProfileAndNotify("Restored session");
    } else {
      this.clearTokens();
      this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null });
    }
  }

  private async handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'google_oauth_pkce') {
      // Remove code/state from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      const codeVerifier = localStorage.getItem(GOOGLE_CODE_VERIFIER_KEY);
      if (!codeVerifier) {
        this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Missing PKCE code verifier." });
        return;
      }
      await this.exchangeCodeForToken(code, codeVerifier);
    }
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string) {
    if (!this.googleClientId) {
      this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Google Client ID missing." });
      return;
    }
    try {
      const params = new URLSearchParams({
        client_id: this.googleClientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: window.location.origin,
      });
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await response.json();
      if (data.access_token) {
        this.saveTokens(data.access_token, data.expires_in, data.refresh_token);
        await this.fetchUserProfileAndNotify("Signed in");
      } else {
        this.clearTokens();
        this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: data.error_description || "Failed to get access token." });
      }
    } catch (err) {
      this.clearTokens();
      this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Token exchange failed." });
    }
  }

  public async signIn(): Promise<void> {
    if (!this.googleClientId) {
      this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Google Client ID not configured." });
      return;
    }
    const codeVerifier = randomString(64);
    const codeChallenge = base64URLEncode(await sha256(codeVerifier));
    localStorage.setItem(GOOGLE_CODE_VERIFIER_KEY, codeVerifier);
    const params = new URLSearchParams({
      client_id: this.googleClientId,
      redirect_uri: window.location.origin,
      response_type: 'code',
      scope: GOOGLE_CALENDAR_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
      state: 'google_oauth_pkce',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  public signOut(): void {
    this.clearTokens();
    this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null });
  }

  public getAccessToken(): string | null {
    if (this.accessToken && this.tokenExpiryTime && this.tokenExpiryTime > Date.now()) {
      return this.accessToken;
    }
    this.clearTokens();
    this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Session expired." });
    return null;
  }

  public onAuthStateChanged(callback: (state: GoogleAuthState) => void): void {
    this.onAuthStateChangedCallback = callback;
  }

  private async fetchUserProfileAndNotify(sourceAction: string = "Signed in"): Promise<void> {
    if (!this.accessToken) {
      this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "No access token to fetch profile." });
      return;
    }
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      const profile = await response.json();
      const user: GoogleUser = {
        email: profile.email,
        name: profile.name || profile.given_name || '',
        picture: profile.picture,
      };
      this.notifyAuthStateChange({ isSignedIn: true, accessToken: this.accessToken, user });
    } catch (err) {
      this.notifyAuthStateChange({ isSignedIn: true, accessToken: this.accessToken, user: null, error: "Failed to fetch user profile." });
    }
  }
}
