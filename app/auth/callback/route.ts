import { isValidRedirectUrl } from '@/app/auth/utils';
import { createClient } from '@/lib/supabase/server';
import { type SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

const handleReferral = async (supabase: SupabaseClient<any, "public", any>, referral: string) => {
  const { data: { user } } = await supabase.auth.getUser();

  if (user && !user.user_metadata?.referral) {
    await supabase.auth.updateUser({
      data: {
        referral,
      }
    });

    await supabase
      .from('users')
      .update({ referral: referral })
      .eq('id', user.id)
      .is('referral', null);

    // you can send a welcome email to the user here
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const referral = searchParams.get('referral') || request.cookies.get('referral_source')?.value

  let next = searchParams.get('next') ?? '/'
  next = next == 'null' ? '/' : next

  if (!isValidRedirectUrl(next)) {
    return NextResponse.redirect(new URL(`/redirect-error?code=invalid_redirect`, origin))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/redirect-error?code=server_error&message=No_code`, origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL(`/redirect-error?code=server_error&message=${error.message}`, origin))
  }

  if (referral) {
    await handleReferral(supabase, referral)
  }

  const response = NextResponse.redirect(`${origin}${next}`)
  if (request.cookies.get('referral_source')) {
    response.cookies.delete('referral_source');
  }
  return response;
}