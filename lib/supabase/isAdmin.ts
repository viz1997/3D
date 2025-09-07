import { db } from '@/db';
import { users as usersSchema } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return false;
  }
  const userDataResults = await db
    .select({ role: usersSchema.role })
    .from(usersSchema)
    .where(eq(usersSchema.id, user.id))
    .limit(1);

  const userData = userDataResults[0];
  return !!userData && userData.role === 'admin';
}