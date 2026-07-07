import { ProfileIcon } from '@/lib/design/icons';
import { initialsFor, money } from '../format';
import { ACHIEVEMENT_KEYS } from '../i18n';
import { Metric, Panel } from '../primitives';
import type { PublicAuthUser, Stats } from '../types';

export function PremiumProfile({ t, authUi, user, nickname, stats }: { t: Record<string, string>; authUi: Record<string, string>; user: PublicAuthUser | null; nickname: string; stats: Stats }) {
  const displayName = nickname || user?.displayName || user?.email?.split('@')[0] || authUi.notSignedIn;
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';
  const highestCorrect = Math.min(15, stats.correct);
  const winRate = stats.games > 0 && stats.bestPrize >= 1000000 ? `${Math.round((1 / stats.games) * 100)}%` : '0%';

  return (
    <Panel title={t.profile} icon={<ProfileIcon size={26} aria-hidden="true" />}>
      <section className="profile-hero-card">
        {user?.avatarUrl ? <img className="profile-avatar" src={user.avatarUrl} alt="" /> : <span className="profile-avatar" aria-hidden="true">{initialsFor(displayName)}</span>}
        <div>
          <p>{authUi.account}</p>
          <h3>{displayName}</h3>
          <span>{nickname || authUi.chooseNickname}</span>
        </div>
      </section>
      <div className="profile-metrics-grid">
        <Metric value={nickname || '—'} label={authUi.nicknamePlaceholder} />
        <Metric value={displayName} label="Display Name" />
        <Metric value={user?.email || '—'} label={authUi.privateEmail} />
        <Metric value={String(stats.games)} label={t.gamesPlayed} />
        <Metric value={money(stats.bestPrize)} label={t.bestWin} gold />
        <Metric value={String(highestCorrect)} label={authUi.stats} />
        <Metric value="0" label={authUi.multiplayerWins} />
        <Metric value={winRate} label={authUi.winRate} />
        <Metric value="—" label={authUi.favoriteCategory} />
        <Metric value={memberSince} label={authUi.memberSince} />
        <Metric value={money(stats.totalMoney)} label={t.moneyTotal} gold />
        <Metric value={String(stats.lifelines)} label={t.lifelinesUsed} />
      </div>
      <div className="profile-achievements-card">
        <h3>{t.achievementsLbl}</h3>
        <div>{stats.achievements.map(item => <span key={item}>{ACHIEVEMENT_KEYS[item] ? t[ACHIEVEMENT_KEYS[item]] : item}</span>)}</div>
        <p>{authUi.achievements}</p>
      </div>
    </Panel>
  );
}
