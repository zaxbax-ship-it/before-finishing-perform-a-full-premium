import type { CommunityRepository } from './schema';

export function createSupabaseCommunityRepository(): CommunityRepository {
  throw new Error(
    'Supabase repository is prepared but not connected yet. Install the Supabase client, add environment variables, enable RLS policies, then complete the live query implementation.'
  );
}
