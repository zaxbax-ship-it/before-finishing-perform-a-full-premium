import { isSupabaseAuthConfigured } from '@/lib/auth/config';
import ResetPasswordForm from './ResetPasswordForm';

export const metadata = { title: 'איפוס סיסמה · משחק השעשועון' };

export default function ResetPasswordPage() {
  return <ResetPasswordForm supabaseConfigured={isSupabaseAuthConfigured()} />;
}
