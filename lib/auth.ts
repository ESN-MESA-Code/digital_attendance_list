import type { User } from "@supabase/supabase-js";

// Google Workspace domain whose members may sign in.
export const WORKSPACE_DOMAIN = (
  process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN || "esnmesa.org"
).toLowerCase();

/**
 * True when the user signed in with Google using an account from our
 * Workspace domain. Google sets the `hd` (hosted domain) claim only for
 * Workspace accounts, so we require it in addition to the email suffix.
 */
export function isWorkspaceUser(user: User | null): user is User {
  if (!user || !WORKSPACE_DOMAIN) return false;
  const email = user.email?.toLowerCase() ?? "";
  const hd = (user.user_metadata?.custom_claims?.hd ?? "").toLowerCase();
  return email.endsWith(`@${WORKSPACE_DOMAIN}`) && hd === WORKSPACE_DOMAIN;
}
