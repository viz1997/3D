'use server';

import { actionResponse, ActionResult } from '@/lib/action-response';
import { getUserBenefits as fetchUserBenefitsInternal, UserBenefits } from '@/lib/stripe/actions';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/types';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export interface DeductCreditsRpcResult {
  success: boolean;
  message: string;
  new_one_time_credits_balance: number;
  new_subscription_credits_balance: number;
  new_total_available_credits: number;
}

export interface DeductCreditsData {
  rpcResult: DeductCreditsRpcResult;
  updatedBenefits: UserBenefits | null;
}

async function callDeductRpc(
  rpcName:
    | 'deduct_one_time_credits'
    | 'deduct_subscription_credits'
    | 'deduct_credits_priority_subscription'
    | 'deduct_credits_priority_one_time',
  amountToDeduct: number,
  currentLocale: string
): Promise<ActionResult<DeductCreditsData | null>> {
  const supabase = await createClient();

  const supabaseAdmin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return actionResponse.unauthorized('User not authenticated.');
  }

  if (amountToDeduct <= 0) {
    return actionResponse.badRequest('Amount to deduct must be positive.');
  }

  try {
    const { data: rpcResponseData, error: rpcError } = await supabaseAdmin.rpc(rpcName, {
      p_user_id: user.id,
      p_amount_to_deduct: amountToDeduct,
    });

    if (rpcError) {
      console.error(`Error calling ${rpcName} RPC:`, rpcError);
      return actionResponse.error(`Failed to call ${rpcName} RPC: ${rpcError.message}`);
    }

    let rpcResultData: DeductCreditsRpcResult | null = null;
    if (rpcResponseData) {
      rpcResultData = rpcResponseData[0] as DeductCreditsRpcResult;
    } else {
      console.error(`${rpcName} RPC returned no data or unexpected structure:`, rpcResponseData);
      return actionResponse.error('Credit deduction RPC returned unexpected data.');
    }

    let updatedBenefits: UserBenefits | null = null;
    try {
      updatedBenefits = await fetchUserBenefitsInternal(user.id);
    } catch (benefitFetchError) {
      console.error(`Error fetching benefits after ${rpcName} for user ${user.id}:`, benefitFetchError);
    }

    return actionResponse.success<DeductCreditsData>({ rpcResult: rpcResultData, updatedBenefits });

  } catch (e: any) {
    console.error(`Unexpected error in ${rpcName}:`, e);
    return actionResponse.error(e.message || 'An unexpected server error occurred.');
  }
}

export async function deductOneTimeCredits(
  amountToDeduct: number, currentLocale: string
): Promise<ActionResult<DeductCreditsData | null>> {
  return callDeductRpc('deduct_one_time_credits', amountToDeduct, currentLocale);
}

export async function deductSubscriptionCredits(
  amountToDeduct: number, currentLocale: string
): Promise<ActionResult<DeductCreditsData | null>> {
  return callDeductRpc('deduct_subscription_credits', amountToDeduct, currentLocale);
}

export async function deductCreditsPrioritizingSubscription(
  amountToDeduct: number, currentLocale: string
): Promise<ActionResult<DeductCreditsData | null>> {
  return callDeductRpc('deduct_credits_priority_subscription', amountToDeduct, currentLocale);
}

export async function deductCreditsPrioritizingOneTime(
  amountToDeduct: number, currentLocale: string
): Promise<ActionResult<DeductCreditsData | null>> {
  return callDeductRpc('deduct_credits_priority_one_time', amountToDeduct, currentLocale);
}

export async function getClientUserBenefits(): Promise<ActionResult<UserBenefits | null>> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return actionResponse.unauthorized();
  }
  try {
    const benefits = await fetchUserBenefitsInternal(user.id);
    if (benefits) {
      return actionResponse.success(benefits);
    }
    return actionResponse.notFound('User benefits not found.');
  } catch (error: any) {
    console.error('Error fetching user benefits for client:', error);
    return actionResponse.error(error.message || 'Failed to fetch user benefits.');
  }
} 