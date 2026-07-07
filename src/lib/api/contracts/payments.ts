import type { UserSubscription, UserEntitlement } from '@/lib/domain/models';
import { isRecord } from './common';

/**
 * Response shape for `POST /api/payments/checkout`.
 * Generates a checkout link for Web, iOS, or Android browser sessions.
 */
export type CheckoutSessionResponse = {
  ok: boolean;
  provider: 'stripe' | 'lemon_squeezy' | 'mock';
  checkoutUrl?: string;
  error?: string;
};

/** Runtime guard validating checkout session responses. */
export function isCheckoutSessionResponse(value: unknown): value is CheckoutSessionResponse {
  if (!isRecord(value)) return false;
  if (typeof value.ok !== 'boolean') return false;
  if (value.ok) {
    return (
      (value.provider === 'stripe' || value.provider === 'lemon_squeezy' || value.provider === 'mock') &&
      (value.checkoutUrl === undefined || typeof value.checkoutUrl === 'string')
    );
  } else {
    return typeof value.error === 'string';
  }
}

/**
 * Response shape for querying active entitlements.
 * Mobile and web clients fetch this to unlock client premium features.
 */
export type EntitlementsResponse = {
  ok: boolean;
  entitlements: UserEntitlement[];
  subscription?: UserSubscription;
  error?: string;
};

/** Runtime guard validating user entitlements query responses. */
export function isEntitlementsResponse(value: unknown): value is EntitlementsResponse {
  if (!isRecord(value)) return false;
  if (typeof value.ok !== 'boolean') return false;
  if (value.ok) {
    if (!Array.isArray(value.entitlements)) return false;
    return value.subscription === undefined || isRecord(value.subscription);
  } else {
    return typeof value.error === 'string';
  }
}
