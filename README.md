# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy .env.example to .env.local and fill in all required environment variables:
   - GEMINI_API_KEY
   - FIREBASE_API_KEY
   - FIREBASE_AUTH_DOMAIN
   - FIREBASE_PROJECT_ID
   - FIREBASE_STORAGE_BUCKET
   - FIREBASE_MESSAGING_SENDER_ID
   - FIREBASE_APP_ID
   - FIREBASE_MEASUREMENT_ID
   - GOOGLE_CLIENT_ID
   - GOOGLE_API_KEY

3. Run the app:
   `npm run dev`

## Deployment with GitHub Actions

To deploy this app using GitHub Actions and securely handle environment variables:

1. Go to your repository on GitHub.
2. Navigate to **Settings → Secrets and variables → Actions**.
3. Add each environment variable from `.env.example` as a new secret (use the same variable names).
4. The GitHub Actions workflow will automatically create a `.env` file from these secrets during deployment.
5. No secrets are ever committed to the repository.

**Required secrets:**
- GEMINI_API_KEY
- FIREBASE_API_KEY
- FIREBASE_AUTH_DOMAIN
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID
- FIREBASE_MEASUREMENT_ID
- VITE_GOOGLE_CLIENT_ID
- GOOGLE_API_KEY

For more details, see `.github/workflows/deploy.yml`.
