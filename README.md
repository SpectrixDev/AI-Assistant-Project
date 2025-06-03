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
