import type { Metadata } from 'next';
import './globals.css';
import './language-menu.css';
import './ads.css';
import './auth.css';
export const metadata: Metadata = { title: 'משחק השעשועון', description: 'פלטפורמת טריוויה עברית פרימיום' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="he" dir="rtl"><body>{children}</body></html>; }
