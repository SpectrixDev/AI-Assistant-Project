
import type { GoogleAuthState, GoogleUser, GoogleTokenResponse } from '../types';

const GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid';
const GOOGLE_ACCESS_TOKEN_KEY = 'google_access_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'google_token_expiry';

declare global {
  interface Window {
    google: any; 
    gapi: any;
  }
}
export class GoogleAuthService {
  private gapiLoaded: Promise<void>;
  private gsiLoaded: Promise<void>;
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private tokenExpiryTime: number | null = null; // Stores timestamp of expiry
  private googleClientId?: string;
  private googleApiKey?: string;

  private onAuthStateChangedCallback: ((state: GoogleAuthState) => void) | null = null;

  constructor(clientId?: string, apiKey?: string) {
    this.googleClientId = clientId;
    this.googleApiKey = apiKey;
    
    this.gapiLoaded = new Promise((resolve, reject) => {
      if (window.gapi && window.gapi.load) {
        window.gapi.load('client', {
          callback: resolve,
          onerror: reject,
          timeout: 5000, 
          ontimeout: reject 
        });
      } else {
        setTimeout(() => {
            if (window.gapi && window.gapi.load) {
                 window.gapi.load('client', { callback: resolve, onerror: reject, timeout: 5000, ontimeout: reject });
            } else {
                console.error("gapi not loaded after delay");
                reject(new Error('Google API (gapi) not loaded.'));
            }
        }, 1000);
      }
    });

    this.gsiLoaded = new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve();
      } else {
        setTimeout(() => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                resolve();
            } else {
                console.error("GSI client not loaded after delay");
                reject(new Error('Google Sign-In (GSI) client not loaded.'));
            }
        }, 1000);
      }
    });

    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    if (!this.googleClientId) {
      console.error("Google Client ID is not configured.");
      this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Google Client ID missing." });
      return;
    }
    try {
      await Promise.all([this.gapiLoaded, this.gsiLoaded]);
      
      await window.gapi.client.init({
        apiKey: this.googleApiKey,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest"],
      });

      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.googleClientId,
        scope: GOOGLE_CALENDAR_SCOPES,
        callback: this.handleTokenResponse.bind(this),
        error_callback: (error: any) => {
            console.error('Google Sign-In error_callback:', error);
            this.clearStoredToken();
            this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: error?.message || 'Sign-in failed' });
        }
      });
      
      // Attempt to load token from storage and auto-sign-in
      this.attemptAutoSignInFromStorage();

    } catch (error) {
      console.error('Error initializing Google Auth Service:', error);
      this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: (error instanceof Error ? error.message : "Initialization failed") });
    }
  }

  private async attemptAutoSignInFromStorage(): Promise<void> {
    const storedToken = localStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY);
    const storedExpiry = localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);

    if (storedToken && storedExpiry) {
        const expiryTime = parseInt(storedExpiry, 10);
        if (expiryTime > Date.now()) {
            this.accessToken = storedToken;
            this.tokenExpiryTime = expiryTime;
            window.gapi.client.setToken({ access_token: this.accessToken });
            await this.fetchUserProfileAndNotify("Restored session");
            return; // Successfully restored session
        } else {
            // Token expired
            this.clearStoredToken();
        }
    }
    // If no valid token, ensure a signed-out state is notified if no other notification has occurred.
    // Typically, the app starts in a signed-out state, so this might be redundant if UI defaults to signed-out.
    // However, explicitly calling it ensures consistency if there was an early error.
    // Check if a notification has already been sent to avoid duplicate notifications
    if (!this.accessToken) { // only notify if not already signed in via some other flow
        this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null });
    }
  }


  private async fetchUserProfileAndNotify(sourceAction: string = "Signed in"): Promise<void> {
    if (!this.accessToken) {
        this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "No access token to fetch profile."});
        return;
    }
    try {
        const profileResponse = await window.gapi.client.oauth2.userinfo.get();
        const profile = profileResponse.result;
        const user: GoogleUser = {
            email: profile.email,
            name: profile.name || profile.given_name || '',
            picture: profile.picture,
        };
        console.log(`Google Auth: ${sourceAction} as ${user.email}`);
        this.notifyAuthStateChange({ isSignedIn: true, accessToken: this.accessToken, user });
    } catch (err) {
        console.error('Error fetching user profile:', err);
        // Still signed in with a token, but profile fetch failed
        this.notifyAuthStateChange({ isSignedIn: true, accessToken: this.accessToken, user: null, error: "Failed to fetch user profile." });
    }
  }

  private async handleTokenResponse(tokenResponse: GoogleTokenResponse): Promise<void> {
    if (tokenResponse.error) {
      console.error('Google Sign-In Token Error:', tokenResponse.error, tokenResponse.error_description);
      this.accessToken = null;
      this.tokenExpiryTime = null;
      this.clearStoredToken();
      this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: tokenResponse.error_description || tokenResponse.error });
      return;
    }

    this.accessToken = tokenResponse.access_token;
    this.tokenExpiryTime = Date.now() + (tokenResponse.expires_in * 1000);
    
    localStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, this.accessToken);
    localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, this.tokenExpiryTime.toString());
    
    window.gapi.client.setToken({ access_token: this.accessToken });
    await this.fetchUserProfileAndNotify("Signed in");
  }
  
  public onAuthStateChanged(callback: (state: GoogleAuthState) => void): void {
    this.onAuthStateChangedCallback = callback;
  }

  private notifyAuthStateChange(state: GoogleAuthState): void {
    if (this.onAuthStateChangedCallback) {
      this.onAuthStateChangedCallback(state);
    }
  }

  private clearStoredToken(): void {
    localStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
  }
  
  public async signIn(): Promise<void> {
    if (!this.googleClientId) {
        this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Google Client ID is not configured. Cannot sign in." });
        return;
    }
    try {
        await Promise.all([this.gapiLoaded, this.gsiLoaded]); 
        if (this.tokenClient) {
            // prompt: '' will attempt silent sign-in if possible.
            // If user is not signed in or needs to grant consent, a popup will appear.
            this.tokenClient.requestAccessToken({ prompt: '' }); 
        } else {
            console.error("Token client not initialized.");
            this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Google auth client not ready." });
        }
    } catch (error) {
        console.error('Google Sign-In request error:', error);
        this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: (error instanceof Error ? error.message : "Sign-in request failed") });
    }
  }

  public signOut(): void {
    const tokenToRevoke = this.accessToken;
    this.accessToken = null;
    this.tokenExpiryTime = null;
    this.clearStoredToken();
    window.gapi.client.setToken(null); // Clear token from GAPI client

    if (tokenToRevoke) {
      // Revoke the token
      window.google.accounts.oauth2.revoke(tokenToRevoke, () => {
        console.log('Google Auth: Token revoked.');
        this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null });
      });
    } else {
       this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null });
    }
  }

  public getAccessToken(): string | null {
    if (this.accessToken && this.tokenExpiryTime && this.tokenExpiryTime > Date.now()) {
      return this.accessToken;
    }
    // If token is expired, clear it and return null
    if (this.accessToken) { // Only clear if there was an access token that expired
        this.accessToken = null;
        this.tokenExpiryTime = null;
        this.clearStoredToken();
        // Notify that user is now signed out due to token expiry, if they were previously considered signed in
        this.notifyAuthStateChange({ isSignedIn: false, accessToken: null, user: null, error: "Session expired." });
    }
    return null;
  }
}
