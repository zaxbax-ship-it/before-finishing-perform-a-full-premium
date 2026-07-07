'use client';

import { useEffect, useRef, useState } from 'react';
import { GlobeIcon } from '@/lib/design/icons';
import type { Locale } from '@/lib/types';
import { LANGUAGE_OPTIONS } from '../constants';

export function LanguageMenu({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const active = LANGUAGE_OPTIONS.find(item => item.value === locale) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [open]);

  return (
    <div className="language-menu" ref={menuRef}>
      <button
        className="language-trigger language-icon-trigger focus-ring"
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Language: ${active.native}`}
        title="Language"
      >
        <span className="language-globe" aria-hidden="true"><GlobeIcon size={22} /></span>
        <span className="sr-only">Language: {active.native}</span>
      </button>
      {open && (
        <div className="language-panel glass" role="menu" aria-label="Choose language">
          {LANGUAGE_OPTIONS.map(item => (
            <button
              key={item.value}
              type="button"
              className={item.value === locale ? 'language-option active' : 'language-option'}
              role="menuitemradio"
              aria-checked={item.value === locale}
              onClick={() => {
                setLocale(item.value);
                setOpen(false);
              }}
            >
              <span>{item.native}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
