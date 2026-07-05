'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AD_SLOTS, getAdsConfig, type AdPlacement } from '@/lib/ads/config';

type AdSlotProps = {
  placement: AdPlacement;
  className?: string;
  reserveSpace?: boolean;
};

export function AdSlot({ placement, className = '', reserveSpace = true }: AdSlotProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const config = useMemo(() => getAdsConfig(), []);
  const slot = AD_SLOTS[placement];

  useEffect(() => {
    if (!slot.lazy) {
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '360px 0px' });

    observer.observe(element);
    return () => observer.disconnect();
  }, [slot.lazy]);

  if (!slot.enabledByDefault && !config.enabled) return null;

  const shouldRenderProvider = config.enabled && config.provider !== 'none' && isVisible;
  const shouldShowPlaceholder = config.showPlaceholders && !shouldRenderProvider;

  return (
    <aside
      ref={ref}
      className={`ad-slot ad-slot-${slot.format} ${className}`}
      data-ad-placement={placement}
      data-ad-provider={config.provider}
      style={reserveSpace ? {
        ['--ad-mobile-height' as string]: `${slot.minHeight.mobile}px`,
        ['--ad-tablet-height' as string]: `${slot.minHeight.tablet}px`,
        ['--ad-desktop-height' as string]: `${slot.minHeight.desktop}px`
      } : undefined}
      aria-label={slot.label}
    >
      {shouldShowPlaceholder && (
        <div className="ad-placeholder">
          <span>Advertising space</span>
          <small>{slot.label}</small>
        </div>
      )}
      {shouldRenderProvider && (
        <div className="ad-provider-shell" data-provider-ready="false">
          <span className="sr-only">Advertising area prepared for {config.provider}</span>
        </div>
      )}
    </aside>
  );
}

export function GameplayAdSlot(props: AdSlotProps) {
  const slot = AD_SLOTS[props.placement];
  if (!slot.gameplaySafe) return null;
  return <AdSlot {...props} />;
}
