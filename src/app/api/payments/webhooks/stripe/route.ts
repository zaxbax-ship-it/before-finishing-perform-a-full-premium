import { NextResponse } from 'next/server';
import { getProductionConfig } from '@/lib/infrastructure/config';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import { createExternalAdapters } from '@/lib/infrastructure/adapters';

export async function POST(request: Request) {
  try {
    const config = getProductionConfig();
    const repositories = getRepositoryProvider();
    const adapters = createExternalAdapters(config);

    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    // Signature verification is performed if secrets are configured
    const webhookSecret = readEnvSecret('STRIPE_WEBHOOK_SECRET');
    if (webhookSecret) {
      const isValid = await adapters.stripe.verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ ok: false, error: 'STRIPE_INVALID_SIGNATURE' }, { status: 400 });
      }
    } else {
      // In local mode or tests without secrets, allow mock payload testing if header matches
      const isMockHeader = request.headers.get('x-mock-webhook') === 'true';
      if (!isMockHeader) {
        return NextResponse.json({ ok: false, error: 'STRIPE_WEBHOOK_UNCONFIGURED' }, { status: 400 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: 'STRIPE_MALFORMED_PAYLOAD' }, { status: 400 });
    }

    const eventType = payload?.type;
    const dataObject = payload?.data?.object;

    if (!eventType || !dataObject) {
      return NextResponse.json({ ok: false, error: 'STRIPE_MISSING_DATA' }, { status: 400 });
    }

    // Process checkout session completion
    if (eventType === 'checkout.session.completed') {
      const userId = dataObject.metadata?.userId || dataObject.client_reference_id;
      const priceId = dataObject.line_items?.[0]?.price?.id || dataObject.metadata?.priceId;
      const providerSubscriptionId = dataObject.subscription;

      if (userId) {
        // Record payment transaction
        await repositories.payments.createTransaction({
          userId,
          provider: 'stripe',
          providerOrderId: dataObject.id,
          amount: dataObject.amount_total ? dataObject.amount_total / 100 : 0,
          currency: dataObject.currency || 'USD',
          status: 'completed',
          details: { eventType, data: dataObject }
        });

        // Grant entitlement
        await repositories.payments.saveEntitlement({
          id: `ent_stripe_${dataObject.id}`,
          userId,
          type: 'premium_solo', // future expansion can check product/price lists
          source: providerSubscriptionId ? 'subscription' : 'one_time',
          status: 'active'
        });

        // Record subscription if present
        if (providerSubscriptionId) {
          await repositories.payments.saveSubscription({
            id: `sub_stripe_${providerSubscriptionId}`,
            userId,
            provider: 'stripe',
            providerSubscriptionId,
            status: 'active'
          });
        }
      }
    }

    // Process subscription events
    if (eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.deleted') {
      const providerSubscriptionId = dataObject.id;
      const status = dataObject.status; // active, trialing, past_due, canceled, unpaid

      const subscription = await repositories.payments.findSubscriptionByProviderId('stripe', providerSubscriptionId);
      if (subscription) {
        let mappedStatus: 'active' | 'cancelled' | 'expired' | 'past_due' | 'unpaid' = 'active';
        if (status === 'canceled') mappedStatus = 'expired';
        else if (status === 'past_due') mappedStatus = 'past_due';
        else if (status === 'unpaid') mappedStatus = 'unpaid';

        await repositories.payments.saveSubscription({
          ...subscription,
          status: mappedStatus,
          endsAt: dataObject.cancel_at ? new Date(dataObject.cancel_at * 1000).toISOString() : undefined
        });

        // Update corresponding entitlement
        const entitlements = await repositories.payments.listEntitlementsByUserId(subscription.userId);
        const entitlement = entitlements.find(e => e.source === 'subscription');
        if (entitlement) {
          await repositories.payments.saveEntitlement({
            ...entitlement,
            status: (mappedStatus === 'active') ? 'active' : 'revoked'
          });
        }
      }
    }

    return NextResponse.json({ ok: true, processed: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'STRIPE_WEBHOOK_INTERNAL_ERROR' }, { status: 500 });
  }
}

function readEnvSecret(name: string): string | undefined {
  try {
    const { readEnv } = require('@/lib/infrastructure/environment');
    return readEnv(name) || undefined;
  } catch {
    return undefined;
  }
}
