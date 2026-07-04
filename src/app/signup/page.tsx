import { isEmailPasswordEnabled, isSupabaseAuthConfigured } from '@/lib/auth/config';
import SignupForm from './SignupForm';

export const metadata = { title: 'יצירת חשבון · משחק השעשועון' };

export default function SignupPage() {
  return (
    <SignupForm
      supabaseConfigured={isSupabaseAuthConfigured()}
      emailPasswordEnabled={isEmailPasswordEnabled()}
    />
  );
}
