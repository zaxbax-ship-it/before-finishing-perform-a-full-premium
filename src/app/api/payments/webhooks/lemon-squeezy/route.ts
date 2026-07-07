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
    const signature = request.headers.get('x-signature') || '';

    // Signature verification is performed if secrets are configured
    const webhookSecret = readEnvSecret('LEMON_SQUEEZY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const isValid = await adapters.lemonSqueezy.verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ ok: false, error: 'LEMON_SQUEEZY_INVALID_SIGNATURE' }, { status: 400 });
      }
    } else {
      // In local mode or tests without secrets, allow mock payload testing if header matches
      const isMockHeader = request.headers.get('x-mock-webhook') === 'true';
      if (!isMockHeader) {
        return NextResponse.json({ ok: false, error: 'LEMON_SQUEEZY_WEBHOOK_UNCONFIGURED' }, { status: 400 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: 'LEMON_SQUEEZY_MALFORMED_PAYLOAD' }, { status: 400 });
    }

    const eventName = payload?.meta?.event_name;
    const dataObject = payload?.data;

    if (!eventName || !dataObject) {
      return NextResponse.json({ ok: false, error: 'LEMON_SQUEEZY_MISSING_DATA' }, { status: 400 });
    }

    const attributes = dataObject.attributes;
    const customData = payload?.meta?.custom_data || attributes?.custom_data;
    const userId = customData?.userId || customData?.user_id;

    // Process order created (one-time checkout completed)
    if (eventName === 'order_created' && userId) {
      // Record payment transaction
      await repositories.payments.createTransaction({
        userId,
        provider: 'lemon_squeezy',
        providerOrderId: String(dataObject.id),
        amount: attributes?.total ? attributes.total / 100 : 0,
        currency: attributes?.currency || 'USD',
        status: 'completed',
        details: { eventName, data: dataObject }
      });

      // Grant entitlement
      await repositories.payments.saveEntitlement({
        id: `ent_ls_${dataObject.id}`,
        userId,
        type: 'premium_solo',
        source: 'one_time',
        status: 'active'
      });
    }

    // Process subscription created/updated
    if ((eventName === 'subscription_created' || eventName === 'subscription_updated' || eventName === 'subscription_cancelled') && userId) {
      const providerSubscriptionId = String(dataObject.id);
      const status = attributes?.status; // active, cancelled, on_trial, expired, past_due, unpaid

      let mappedStatus: 'active' | 'cancelled' | 'expired' | 'past_due' | 'unpaid' = 'active';
      if (status === 'cancelled') mappedStatus = 'cancelled';
      else if (status === 'expired') mappedStatus = 'expired';
      else if (status === 'past_due') mappedStatus = 'past_due';
      else if (status === 'unpaid') mappedStatus = 'unpaid';

      // Save subscription
      const sub = await repositories.payments.saveSubscription({
        id: `sub_ls_${providerSubscriptionId}`,
        userId,
        provider: 'lemon_squeezy',
        providerSubscriptionId,
        status: mappedStatus,
        endsAt: attributes?.ends_at || undefined
      });

      // Sync entitlement status
      const entitlements = await repositories.payments.listEntitlementsByUserId(userId);
      const entitlement = entitlements.find(e => e.source === 'subscription');
      if (entitlement) {
        await repositories.payments.saveEntitlement({
          ...entitlement,
          status: (mappedStatus === 'active') ? 'active' : 'revoked'
        });
      } else if (mappedStatus === 'active') {
        await repositories.payments.saveEntitlement({
          id: `ent_ls_sub_${providerSubscriptionId}`,
          userId,
          type: 'premium_solo',
          source: 'subscription',
          status: 'active'
        });
      }
    }

    return NextResponse.json({ ok: true, processed: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'LEMON_SQUEEZY_WEBHOOK_INTERNAL_ERROR' }, { status: 500 });
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
