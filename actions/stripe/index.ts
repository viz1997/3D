'use server';

import { getErrorMessage } from '@/lib/error-utils';
import stripe from '@/lib/stripe/stripe';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createStripePortalSession(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let portalUrl: string | null = null;
  try {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      throw new Error(`Could not find Stripe customer ID: ${profileError?.message || 'No profile found'}`);
    }
    const customerId = profile.stripe_customer_id;

    const headersList = await headers();
    const domain = headersList.get('x-forwarded-host') || headersList.get('host') || process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '');
    const protocol = headersList.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    if (!domain) throw new Error("Could not determine domain for return URL.");
    const returnUrl = `${protocol}://${domain}/${process.env.STRIPE_CUSTOMER_PORTAL_URL}`;

    if (!stripe) {
      console.error('Stripe is not initialized. Please check your environment variables.');
      throw new Error(`Stripe is not initialized. Please check your environment variables.`);
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    if (!portalSession.url) {
      throw new Error('Failed to create Stripe portal session (URL missing).');
    }
    portalUrl = portalSession.url;

  } catch (error) {
    console.error('Error preparing Stripe portal session:', error);
    const errorMessage = getErrorMessage(error);
    redirect(`/stripe-error?message=Failed to open subscription management: ${encodeURIComponent(errorMessage)}`);
  }

  if (portalUrl) {
    redirect(portalUrl);
  } else {
    redirect(`/stripe-error?message=Failed to get portal URL after creation attempt.`);
  }
}