import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isWorkspaceUser } from "@/lib/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Per-request Supabase client bound to the signed-in user's cookies. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component – the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Whether the signed-in user accepted the current confidentiality rules. The
 * database decides (public.is_workspace_member()), the same check every
 * organiser policy uses.
 */
export async function acceptedConfidentiality(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("is_workspace_member");
  return !error && data === true;
}

/** The signed-in Workspace user, or null (whether or not they accepted the confidentiality rules). */
export async function getWorkspaceUser() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isWorkspaceUser(user) ? user : null;
}

/** The signed-in Workspace user who accepted the confidentiality rules, or null. */
export async function getOrganiser() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isWorkspaceUser(user)) return null;
  return (await acceptedConfidentiality(supabase)) ? user : null;
}
