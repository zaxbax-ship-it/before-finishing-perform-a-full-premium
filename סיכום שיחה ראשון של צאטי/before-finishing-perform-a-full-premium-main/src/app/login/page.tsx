import { isEmailPasswordEnabled, isGoogleOAuthConfigured, isSupabaseAuthConfigured } from '@/lib/auth/config';
import LoginForm from './LoginForm';

export const metadata = { title: 'כניסה לחשבון · משחק השעשועון' };

export default function LoginPage() {
  return (
    <LoginForm
      supabaseConfigured={isSupabaseAuthConfigured()}
      emailPasswordEnabled={isEmailPasswordEnabled()}
      googleOAuthConfigured={isGoogleOAuthConfigured()}
    />
  );
}
