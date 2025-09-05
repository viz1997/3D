'use server';

import { db } from '@/db';
import { pricingPlans } from '@/db/schema';
import { actionResponse, ActionResult } from '@/lib/action-response';
import { getErrorMessage } from '@/lib/error-utils';
import { PricingPlan } from "@/types/pricing";
import { and, asc, eq } from 'drizzle-orm';
import 'server-only';

/**
 * Public List
 */
export async function getPublicPricingPlans(): Promise<
  ActionResult<PricingPlan[]>
> {
  const environment = process.env.NODE_ENV === 'production' ? 'live' : 'test'

  try {
    const plans = await db
      .select()
      .from(pricingPlans)
      .where(
        and(
          eq(pricingPlans.environment, environment),
          eq(pricingPlans.is_active, true)
        )
      )
      .orderBy(asc(pricingPlans.display_order))

    return actionResponse.success((plans as unknown as PricingPlan[]) || [])
  } catch (error) {
    console.error('Unexpected error in getPublicPricingPlans:', error)
    return actionResponse.error(getErrorMessage(error))
  }
}