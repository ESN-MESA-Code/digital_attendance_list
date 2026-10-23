// Executives are the members of a Google Workspace group (EXECUTIVES_GROUP,
// e.g. board@esnmesa.org). They see the names on closed attendance lists;
// other organisers only while a list is open. The database decides from
// public.executives, which this keeps in step with the group:
// * at each login, for the person signing in (app/auth/callback),
// * daily, for everyone (app/api/cron/sync-executives).
// Server only.
import { supabaseAdmin } from "@/lib/supabase/server";
import { accessToken, groupMemberEmails, isGroupMember, serviceAccountFromEnv } from "@/lib/google/directory";

function config() {
  const group = process.env.EXECUTIVES_GROUP;
  const sa = serviceAccountFromEnv();
  return group && sa ? { group, sa } : null;
}

export function executivesConfigured() {
  return config() !== null;
}

/**
 * Replaces public.executives with the group's members. Refuses an empty
 * group, which is far more likely a misconfiguration than a board without
 * members – nothing changes then.
 */
export async function syncExecutives(): Promise<number> {
  const c = config();
  if (!c) throw new Error("Executives sync is not configured (EXECUTIVES_GROUP, GOOGLE_SERVICE_ACCOUNT_*)");
  const emails = await groupMemberEmails(c.group, await accessToken(c.sa));
  if (emails.length === 0) throw new Error(`${c.group} has no members – executives left unchanged`);
  const { data, error } = await supabaseAdmin.rpc("replace_executives", { emails });
  if (error) throw error;
  return data as number;
}

/** Updates one person's executive status (at login). Does nothing when not configured. */
export async function refreshExecutive(email: string): Promise<void> {
  const c = config();
  if (!c) return;
  const member = await isGroupMember(c.group, email, await accessToken(c.sa));
  const { error } = await supabaseAdmin.rpc("set_executive", { member_email: email, member });
  if (error) throw error;
}
