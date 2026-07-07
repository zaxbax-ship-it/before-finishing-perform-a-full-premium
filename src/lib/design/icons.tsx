'use client';

import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CircleHelp,
  Coins,
  Copy,
  CreditCard,
  Crown,
  Download,
  Gamepad2,
  Globe,
  Heart,
  History,
  Home,
  LifeBuoy,
  Lightbulb,
  LogIn,
  LogOut,
  Mail,
  Medal,
  Pause,
  PenLine,
  Percent,
  Phone,
  PieChart,
  Play,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  User,
  Users,
  Wallet,
  X
} from 'lucide-react';

export type AppIconProps = LucideProps;

function createSemanticIcon(Icon: LucideIcon) {
  return function SemanticIcon(props: AppIconProps) {
    return <Icon aria-hidden="true" {...props} />;
  };
}

export const PremiumIcon = createSemanticIcon(Crown);
export const CoinsIcon = createSemanticIcon(Coins);
export const RewardsIcon = createSemanticIcon(Coins);
export const AchievementsIcon = createSemanticIcon(Trophy);
export const LeaderboardIcon = createSemanticIcon(Medal);
export const ProfileIcon = createSemanticIcon(User);
export const FriendsIcon = createSemanticIcon(Users);
export const MultiplayerIcon = createSemanticIcon(Users);
export const SoloIcon = createSemanticIcon(Gamepad2);
export const QuizIcon = createSemanticIcon(Sparkles);
export const QuestionIcon = createSemanticIcon(CircleHelp);
export const CategoriesIcon = createSemanticIcon(ScrollText);
export const HintsIcon = createSemanticIcon(Lightbulb);
export const StatisticsIcon = createSemanticIcon(BarChart3);
export const SettingsIcon = createSemanticIcon(Settings);
export const NotificationIcon = createSemanticIcon(Bell);
export const SearchIcon = createSemanticIcon(Search);
export const RefreshIcon = createSemanticIcon(RefreshCw);
export const HomeIcon = createSemanticIcon(Home);
export const BackIcon = createSemanticIcon(ArrowLeft);
export const ForwardIcon = createSemanticIcon(ArrowRight);
export const PlayIcon = createSemanticIcon(Play);
export const PauseIcon = createSemanticIcon(Pause);
export const ShareIcon = createSemanticIcon(Share2);
export const FavoritesIcon = createSemanticIcon(Heart);
export const HistoryIcon = createSemanticIcon(History);
export const PaymentsIcon = createSemanticIcon(CreditCard);
export const WalletIcon = createSemanticIcon(Wallet);
export const SubscriptionIcon = createSemanticIcon(RefreshCw);
export const AdminIcon = createSemanticIcon(ShieldCheck);
export const ModeratorIcon = createSemanticIcon(Shield);
export const EmailIcon = createSemanticIcon(Mail);
export const MailIcon = createSemanticIcon(Mail);
export const SupportIcon = createSemanticIcon(LifeBuoy);
export const SecurityIcon = createSemanticIcon(Shield);
export const LoginIcon = createSemanticIcon(LogIn);
export const LogoutIcon = createSemanticIcon(LogOut);
export const PremiumBadgeIcon = createSemanticIcon(Sparkles);
export const CelebrationIcon = createSemanticIcon(Sparkles);
export const CopyIcon = createSemanticIcon(Copy);
export const EditIcon = createSemanticIcon(PenLine);
export const DeleteIcon = createSemanticIcon(Trash2);
export const ImportIcon = createSemanticIcon(Upload);
export const ExportIcon = createSemanticIcon(Download);
export const ConfirmIcon = createSemanticIcon(Check);
export const CloseIcon = createSemanticIcon(X);
export const WarningIcon = createSemanticIcon(AlertTriangle);
export const GlobeIcon = createSemanticIcon(Globe);
export const TimerIcon = createSemanticIcon(History);

export const FiftyFiftyIcon = createSemanticIcon(Percent);
export const SwapQuestionIcon = createSemanticIcon(RefreshCw);
export const PhoneFriendIcon = createSemanticIcon(Phone);
export const AudienceIcon = createSemanticIcon(PieChart);

export const SOLO_LIFELINE_ICONS = {
  fifty: FiftyFiftyIcon,
  swap: SwapQuestionIcon,
  phone: PhoneFriendIcon,
  audience: AudienceIcon
} as const;

export const MULTIPLAYER_LIFELINE_ICONS = {
  fifty_fifty: FiftyFiftyIcon,
  audience: AudienceIcon,
  friend: PhoneFriendIcon
} as const;
