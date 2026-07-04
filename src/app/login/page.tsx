import { isEmailPasswordEnabled, isSupabaseAuthConfigured } from '@/lib/auth/config';
import LoginForm from './LoginForm';

export const metadata = { title: 'כניסת מנהלים · משחק השעשועון' };

export default function LoginPage() {
  return (
    <LoginForm
      supabaseConfigured={isSupabaseAuthConfigured()}
      emailPasswordEnabled={isEmailPasswordEnabled()}
    />
  );
}
