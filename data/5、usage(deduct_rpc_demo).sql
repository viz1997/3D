-- 1. Deduct One-Time Credits Only
CREATE OR REPLACE FUNCTION deduct_one_time_credits(p_user_id UUID, p_amount_to_deduct INTEGER)
RETURNS TABLE (success BOOLEAN, message TEXT, new_one_time_credits_balance INTEGER, new_subscription_credits_balance INTEGER, new_total_available_credits INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_one_time INTEGER;
  current_subscription INTEGER;
BEGIN
  SELECT COALESCE(one_time_credits_balance, 0), COALESCE(subscription_credits_balance, 0)
  INTO current_one_time, current_subscription
  FROM public.usage WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'User has no credit balance.', 0, 0, 0;
    RETURN;
  END IF;

  IF current_one_time < p_amount_to_deduct THEN
    RETURN QUERY SELECT FALSE, 'Insufficient one-time credits. Required: ' || p_amount_to_deduct || ', Available: ' || current_one_time, current_one_time, current_subscription, current_one_time + current_subscription;
    RETURN;
  END IF;

  UPDATE public.usage
  SET one_time_credits_balance = current_one_time - p_amount_to_deduct, updated_at = NOW()
  WHERE user_id = p_user_id;

  current_one_time := current_one_time - p_amount_to_deduct;
  RETURN QUERY SELECT TRUE, 'Deducted ' || p_amount_to_deduct || ' from one-time credits.', current_one_time, current_subscription, current_one_time + current_subscription;
EXCEPTION WHEN OTHERS THEN 
  RAISE WARNING 'Error: %', SQLERRM;
  RETURN QUERY SELECT 
    FALSE, 
    'Error: ' || SQLERRM, 
    COALESCE((SELECT u.one_time_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0), 
    COALESCE((SELECT u.subscription_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0), 
    COALESCE((SELECT u.one_time_credits_balance + u.subscription_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0);
END;
$$;

-- 2. Deduct Subscription Credits Only
CREATE OR REPLACE FUNCTION deduct_subscription_credits(p_user_id UUID, p_amount_to_deduct INTEGER)
RETURNS TABLE (success BOOLEAN, message TEXT, new_one_time_credits_balance INTEGER, new_subscription_credits_balance INTEGER, new_total_available_credits INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_one_time INTEGER;
  current_subscription INTEGER;
BEGIN
  SELECT COALESCE(one_time_credits_balance, 0), COALESCE(subscription_credits_balance, 0)
  INTO current_one_time, current_subscription
  FROM public.usage WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'User has no credit balance.', 0, 0, 0;
    RETURN;
  END IF;

  IF current_subscription < p_amount_to_deduct THEN
    RETURN QUERY SELECT FALSE, 'Insufficient subscription credits. Required: ' || p_amount_to_deduct || ', Available: ' || current_subscription, current_one_time, current_subscription, current_one_time + current_subscription;
    RETURN;
  END IF;

  UPDATE public.usage
  SET subscription_credits_balance = current_subscription - p_amount_to_deduct, updated_at = NOW()
  WHERE user_id = p_user_id;

  current_subscription := current_subscription - p_amount_to_deduct;
  RETURN QUERY SELECT TRUE, 'Deducted ' || p_amount_to_deduct || ' from subscription credits.', current_one_time, current_subscription, current_one_time + current_subscription;
EXCEPTION WHEN OTHERS THEN 
  RAISE WARNING 'Error: %', SQLERRM; 
  RETURN QUERY SELECT 
    FALSE, 
    'Error: ' || SQLERRM, 
    COALESCE((SELECT u.one_time_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0), 
    COALESCE((SELECT u.subscription_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0), 
    COALESCE((SELECT u.one_time_credits_balance + u.subscription_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0);
END;
$$;

-- 3. Deduct Credits, Prioritizing Subscription Credits
CREATE OR REPLACE FUNCTION deduct_credits_priority_subscription(p_user_id UUID, p_amount_to_deduct INTEGER)
RETURNS TABLE (success BOOLEAN, message TEXT, new_one_time_credits_balance INTEGER, new_subscription_credits_balance INTEGER, new_total_available_credits INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_one_time INTEGER;
  current_subscription INTEGER;
  total_available INTEGER;
  deducted_from_sub INTEGER := 0;
  deducted_from_one_time INTEGER := 0;
  remaining_deduction INTEGER := p_amount_to_deduct;
BEGIN
  SELECT COALESCE(one_time_credits_balance, 0), COALESCE(subscription_credits_balance, 0)
  INTO current_one_time, current_subscription
  FROM public.usage WHERE user_id = p_user_id;

  IF NOT FOUND THEN 
    RETURN QUERY SELECT FALSE, 'User has no credit balance.', 0, 0, 0; 
    RETURN; 
  END IF;
  total_available := current_one_time + current_subscription;
  IF total_available < p_amount_to_deduct THEN 
    RETURN QUERY SELECT FALSE, 'Insufficient credits. Required: ' || p_amount_to_deduct || ', Available: ' || total_available, current_one_time, current_subscription, total_available; 
    RETURN; 
  END IF;

  IF current_subscription >= remaining_deduction THEN
    deducted_from_sub := remaining_deduction;
    current_subscription := current_subscription - remaining_deduction;
    remaining_deduction := 0;
  ELSE
    deducted_from_sub := current_subscription;
    remaining_deduction := remaining_deduction - current_subscription;
    current_subscription := 0;
  END IF;

  IF remaining_deduction > 0 AND current_one_time >= remaining_deduction THEN
    deducted_from_one_time := remaining_deduction;
    current_one_time := current_one_time - remaining_deduction;
    remaining_deduction := 0;
  ELSIF remaining_deduction > 0 THEN
    deducted_from_one_time := current_one_time;
    current_one_time := 0;
    remaining_deduction := remaining_deduction - deducted_from_one_time; 
  END IF;
  
  IF remaining_deduction > 0 THEN
    RAISE WARNING 'Deduct credits (priority sub) calculation error for user %: amount %, remaining %', p_user_id, p_amount_to_deduct, remaining_deduction;
    SELECT COALESCE(u.one_time_credits_balance, 0), COALESCE(u.subscription_credits_balance, 0) INTO current_one_time, current_subscription FROM public.usage u WHERE u.user_id = p_user_id;
    RETURN QUERY SELECT FALSE, 'Credit deduction calculation error.', current_one_time, current_subscription, current_one_time + current_subscription;
    RETURN;
  END IF;

  UPDATE public.usage SET one_time_credits_balance = current_one_time, subscription_credits_balance = current_subscription, updated_at = NOW() WHERE user_id = p_user_id;
  RETURN QUERY SELECT TRUE, 'Credits deducted. From Subscription: ' || deducted_from_sub || '. From One-Time: ' || deducted_from_one_time, current_one_time, current_subscription, current_one_time + current_subscription;
EXCEPTION WHEN OTHERS THEN 
  RAISE WARNING 'Error: %', SQLERRM; 
  RETURN QUERY SELECT 
    FALSE, 
    'Error: ' || SQLERRM, 
    COALESCE((SELECT u.one_time_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0), 
    COALESCE((SELECT u.subscription_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0), 
    COALESCE((SELECT u.one_time_credits_balance + u.subscription_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0);
END;
$$;

-- 4. Deduct Credits, Prioritizing One-Time Credits (Original Logic)
CREATE OR REPLACE FUNCTION deduct_credits_priority_one_time(p_user_id UUID, p_amount_to_deduct INTEGER)
RETURNS TABLE (success BOOLEAN, message TEXT, new_one_time_credits_balance INTEGER, new_subscription_credits_balance INTEGER, new_total_available_credits INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_one_time INTEGER;
  current_subscription INTEGER;
  total_available INTEGER;
  deducted_from_one_time INTEGER := 0;
  deducted_from_sub INTEGER := 0;
  remaining_deduction INTEGER := p_amount_to_deduct;
BEGIN
  SELECT COALESCE(one_time_credits_balance, 0), COALESCE(subscription_credits_balance, 0)
  INTO current_one_time, current_subscription
  FROM public.usage WHERE user_id = p_user_id;

  IF NOT FOUND THEN 
    RETURN QUERY SELECT FALSE, 'User has no credit balance.', 0, 0, 0; 
    RETURN; 
  END IF;
  total_available := current_one_time + current_subscription;
  IF total_available < p_amount_to_deduct THEN 
    RETURN QUERY SELECT FALSE, 'Insufficient credits. Required: ' || p_amount_to_deduct || ', Available: ' || total_available, current_one_time, current_subscription, total_available; 
    RETURN; 
  END IF;

  IF current_one_time >= remaining_deduction THEN
    deducted_from_one_time := remaining_deduction;
    current_one_time := current_one_time - remaining_deduction;
    remaining_deduction := 0;
  ELSE
    deducted_from_one_time := current_one_time;
    remaining_deduction := remaining_deduction - current_one_time;
    current_one_time := 0;
  END IF;

  IF remaining_deduction > 0 AND current_subscription >= remaining_deduction THEN
    deducted_from_sub := remaining_deduction;
    current_subscription := current_subscription - remaining_deduction;
    remaining_deduction := 0;
  ELSIF remaining_deduction > 0 THEN
    deducted_from_sub := current_subscription;
    current_subscription := 0;
    remaining_deduction := remaining_deduction - deducted_from_sub;
  END IF;

  IF remaining_deduction > 0 THEN
    RAISE WARNING 'Deduct credits (priority one-time) calculation error for user %: amount %, remaining %', p_user_id, p_amount_to_deduct, remaining_deduction;
    SELECT COALESCE(u.one_time_credits_balance, 0), COALESCE(u.subscription_credits_balance, 0) INTO current_one_time, current_subscription FROM public.usage u WHERE u.user_id = p_user_id;
    RETURN QUERY SELECT FALSE, 'Credit deduction calculation error.', current_one_time, current_subscription, current_one_time + current_subscription;
    RETURN;
  END IF;

  UPDATE public.usage SET one_time_credits_balance = current_one_time, subscription_credits_balance = current_subscription, updated_at = NOW() WHERE user_id = p_user_id;
  RETURN QUERY SELECT TRUE, 'Credits deducted. From One-Time: ' || deducted_from_one_time || '. From Subscription: ' || deducted_from_sub, current_one_time, current_subscription, current_one_time + current_subscription;
EXCEPTION WHEN OTHERS THEN 
  RAISE WARNING 'Error: %', SQLERRM; 
  RETURN QUERY SELECT 
    FALSE, 
    'Error: ' || SQLERRM, 
    COALESCE((SELECT u.one_time_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0), 
    COALESCE((SELECT u.subscription_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0), 
    COALESCE((SELECT u.one_time_credits_balance + u.subscription_credits_balance FROM public.usage u WHERE u.user_id = p_user_id LIMIT 1),0);
END;
$$;
; 