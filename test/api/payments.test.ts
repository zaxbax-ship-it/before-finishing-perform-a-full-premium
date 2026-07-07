import { describe, expect, it } from 'vitest';
import { POST as checkoutPost } from '@/app/api/payments/checkout/route';
import { POST as stripeWebhookPost } from '@/app/api/payments/webhooks/stripe/route';
import { POST as lemonSqueezyWebhookPost } from '@/app/api/payments/webhooks/lemon-squeezy/route';
import { isCheckoutSessionResponse } from '@/lib/api/contracts/payments';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

describe('Payment & Checkout API Integration Tests', () => {
  it('POST /api/payments/checkout rejects requests with missing fields', async () => {
    const request = new Request('http://localhost/api/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ provider: 'stripe' })
    });
    const response = await checkoutPost(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('PAYMENT_MISSING_REQUIRED_FIELDS');
  });

  it('POST /api/payments/checkout rejects unsupported providers', async () => {
    const request = new Request('http://localhost/api/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'paypal',
        priceId: 'price_123',
        successUrl: 'http://localhost/success',
        cancelUrl: 'http://localhost/cancel'
      })
    });
    const response = await checkoutPost(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('PAYMENT_UNSUPPORTED_PROVIDER');
  });

  it('POST /api/payments/checkout creates a checkout session with mock fallback when config is empty', async () => {
    const request = new Request('http://localhost/api/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'stripe',
        priceId: 'price_123',
        successUrl: 'http://localhost/success',
        cancelUrl: 'http://localhost/cancel'
      })
    });
    const response = await checkoutPost(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(isCheckoutSessionResponse(body)).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe('mock');
    expect(body.checkoutUrl).toContain('http://localhost/success');
  });

  it('POST /api/payments/webhooks/stripe processes mock checkout.session.completed event', async () => {
    const mockTransactionId = `session_stripe_test_${Date.now()}`;
    const mockUserId = `user_test_${Date.now()}`;

    const payload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: mockTransactionId,
          client_reference_id: mockUserId,
          amount_total: 499,
          currency: 'usd',
          subscription: 'sub_test_123',
          metadata: { userId: mockUserId }
        }
      }
    };

    const request = new Request('http://localhost/api/payments/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': 'mock_sig',
        'x-mock-webhook': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const response = await stripeWebhookPost(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(true);

    // Verify written results in repository provider
    const repositories = getRepositoryProvider();
    const entitlements = await repositories.payments.listEntitlementsByUserId(mockUserId);
    expect(entitlements.some(e => e.type === 'premium_solo' && e.status === 'active')).toBe(true);

    const subscription = await repositories.payments.findSubscriptionByUserId(mockUserId);
    expect(subscription).toBeDefined();
    expect(subscription?.providerSubscriptionId).toBe('sub_test_123');
    expect(subscription?.status).toBe('active');
  });

  it('POST /api/payments/webhooks/lemon-squeezy processes mock subscription_created event', async () => {
    const mockUserId = `user_ls_test_${Date.now()}`;
    const mockSubscriptionId = `sub_ls_test_${Date.now()}`;

    const payload = {
      meta: {
        event_name: 'subscription_created',
        custom_data: { userId: mockUserId }
      },
      data: {
        id: mockSubscriptionId,
        attributes: {
          status: 'active',
          total: 999,
          currency: 'USD',
          ends_at: null
        }
      }
    };

    const request = new Request('http://localhost/api/payments/webhooks/lemon-squeezy', {
      method: 'POST',
      headers: {
        'x-signature': 'mock_sig',
        'x-mock-webhook': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const response = await lemonSqueezyWebhookPost(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(true);

    // Verify written results in repository provider
    const repositories = getRepositoryProvider();
    const entitlements = await repositories.payments.listEntitlementsByUserId(mockUserId);
    expect(entitlements.some(e => e.type === 'premium_solo' && e.status === 'active')).toBe(true);

    const subscription = await repositories.payments.findSubscriptionByProviderId('lemon_squeezy', mockSubscriptionId);
    expect(subscription).toBeDefined();
    expect(subscription?.status).toBe('active');
  });
});
