import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/session';
import { getProductionConfig } from '@/lib/infrastructure/config';
import { createExternalAdapters } from '@/lib/infrastructure/adapters';
import type { CheckoutSessionResponse } from '@/lib/api/contracts/payments';

type CheckoutPostBody = {
  provider?: unknown;
  priceId?: unknown;
  successUrl?: unknown;
  cancelUrl?: unknown;
};

export async function POST(request: Request) {
  try {
    let body: CheckoutPostBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'PAYMENT_MALFORMED_JSON' },
        { status: 400 }
      );
    }

    const providerInput = typeof body.provider === 'string' ? body.provider.trim() : '';
    const priceId = typeof body.priceId === 'string' ? body.priceId.trim() : '';
    const successUrl = typeof body.successUrl === 'string' ? body.successUrl.trim() : '';
    const cancelUrl = typeof body.cancelUrl === 'string' ? body.cancelUrl.trim() : '';

    if (!providerInput || !priceId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { ok: false, error: 'PAYMENT_MISSING_REQUIRED_FIELDS' },
        { status: 400 }
      );
    }

    if (providerInput !== 'stripe' && providerInput !== 'lemon_squeezy') {
      return NextResponse.json(
        { ok: false, error: 'PAYMENT_UNSUPPORTED_PROVIDER' },
        { status: 400 }
      );
    }

    const config = getProductionConfig();
    const user = await getAuthUser();
    const adapters = createExternalAdapters(config);

    // Stripe Flow
    if (providerInput === 'stripe') {
      if (config.payments.stripeConfigured) {
        try {
          const session = await adapters.stripe.createCheckoutSession({
            userId: user?.id,
            userEmail: user?.email,
            priceId,
            successUrl,
            cancelUrl
          });
          return NextResponse.json({
            ok: true,
            provider: 'stripe',
            checkoutUrl: session.checkoutUrl
          } satisfies CheckoutSessionResponse);
        } catch (err: any) {
          return NextResponse.json(
            { ok: false, error: err?.message || 'STRIPE_SESSION_CREATION_FAILED' },
            { status: 500 }
          );
        }
      }
    }

    // Lemon Squeezy Flow
    if (providerInput === 'lemon_squeezy') {
      if (config.payments.lemonSqueezyConfigured) {
        try {
          const session = await adapters.lemonSqueezy.createCheckoutSession({
            userId: user?.id,
            userEmail: user?.email,
            priceId,
            successUrl,
            cancelUrl
          });
          return NextResponse.json({
            ok: true,
            provider: 'lemon_squeezy',
            checkoutUrl: session.checkoutUrl
          } satisfies CheckoutSessionResponse);
        } catch (err: any) {
          return NextResponse.json(
            { ok: false, error: err?.message || 'LEMON_SQUEEZY_SESSION_CREATION_FAILED' },
            { status: 500 }
          );
        }
      }
    }

    // Mock Mode Fallback (used when secrets are not supplied, avoiding real purchases & requirements)
    const mockSessionId = `mock_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const separator = successUrl.includes('?') ? '&' : '?';
    const mockCheckoutUrl = `${successUrl}${separator}session_id=${mockSessionId}&price_id=${priceId}`;

    return NextResponse.json({
      ok: true,
      provider: 'mock',
      checkoutUrl: mockCheckoutUrl
    } satisfies CheckoutSessionResponse);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'PAYMENT_CHECKOUT_INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
