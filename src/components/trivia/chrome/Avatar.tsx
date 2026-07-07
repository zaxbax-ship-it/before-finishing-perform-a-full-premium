import type { PublicAuthUser } from '../types';

export function Avatar({ user, initials }: { user: PublicAuthUser; initials: string }) {
  return user.avatarUrl
    ? <img className="public-avatar" src={user.avatarUrl} alt="" />
    : <span className="public-avatar" aria-hidden="true">{initials}</span>;
}
