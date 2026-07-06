# Google OAuth Setup

Google sign-in is disabled in the UI until the provider is fully configured.
Email/password authentication continues to work independently.

## Google Cloud

1. Open Google Cloud Console.
2. Create or select a project.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Web Client.
5. Add this Supabase redirect URI:
   `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
6. Copy the Google Client ID and Client Secret.

## Supabase

1. Open the Supabase project.
2. Go to `Authentication` -> `Providers` -> `Google`.
3. Enable Google.
4. Paste the Google Client ID and Client Secret.
5. Save the provider settings.

## Vercel Environment Variables

Set these server-only variables:

```env
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
```

Confirm this public variable points to the deployed site:

```env
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
```

Redeploy after changing environment variables. The login and signup pages will
enable the Google button only after these values are present.
