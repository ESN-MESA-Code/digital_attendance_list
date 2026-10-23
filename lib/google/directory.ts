// Reads the members of a Google Workspace group with the Admin SDK Directory
// API, as a service account. Only the server uses this (lib/executives.ts).
//
// The service account needs read access to groups, either
// * an admin role with the "Groups → Read" privilege assigned to it in the
//   Admin console (GOOGLE_ADMIN_SUBJECT unset), or
// * domain-wide delegation for the scope below, impersonating a Workspace
//   admin (GOOGLE_ADMIN_SUBJECT = that admin's email).
import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DIRECTORY = "https://admin.googleapis.com/admin/directory/v1";
export const GROUP_MEMBER_SCOPE = "https://www.googleapis.com/auth/admin.directory.group.member.readonly";

export interface ServiceAccount {
  email: string;
  /** PEM private key from the service account's JSON key */
  privateKey: string;
  /** Workspace admin to impersonate (domain-wide delegation), if any */
  subject?: string;
}

type Fetch = typeof fetch;

/** The service account from the environment, or null when not configured. */
export function serviceAccountFromEnv(env: Record<string, string | undefined> = process.env): ServiceAccount | null {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!email || !key) return null;
  return {
    email,
    // Hosting dashboards often store the key's line breaks as "\n".
    privateKey: key.replace(/\\n/g, "\n"),
    subject: env.GOOGLE_ADMIN_SUBJECT || undefined,
  };
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/** The signed JWT a service account trades for an access token (RFC 7523). */
export function signedAssertion(sa: ServiceAccount, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.email,
      scope: GROUP_MEMBER_SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
      ...(sa.subject && { sub: sa.subject }),
    })
  );
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.privateKey);
  return `${header}.${claims}.${b64url(signature)}`;
}

export async function accessToken(sa: ServiceAccount, fetchFn: Fetch = fetch): Promise<string> {
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedAssertion(sa),
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status}): ${await res.text()}`);
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error("Google token response without access_token");
  return access_token;
}

interface MembersPage {
  members?: Array<{ email?: string; type?: string; status?: string }>;
  nextPageToken?: string;
}

/** Email addresses of the group's users, including members of nested groups; suspended users left out. */
export async function groupMemberEmails(group: string, token: string, fetchFn: Fetch = fetch): Promise<string[]> {
  const emails = new Set<string>();
  let pageToken: string | undefined;
  do {
    const url = new URL(`${DIRECTORY}/groups/${encodeURIComponent(group)}/members`);
    url.searchParams.set("maxResults", "200");
    url.searchParams.set("includeDerivedMembership", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Listing ${group} failed (${res.status}): ${await res.text()}`);
    const page = (await res.json()) as MembersPage;
    for (const m of page.members ?? []) {
      if (m.type === "USER" && m.status !== "SUSPENDED" && m.email) emails.add(m.email.toLowerCase());
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return [...emails];
}

/** Whether `email` is in the group, directly or through a nested group. */
export async function isGroupMember(group: string, email: string, token: string, fetchFn: Fetch = fetch) {
  const url = `${DIRECTORY}/groups/${encodeURIComponent(group)}/hasMember/${encodeURIComponent(email)}`;
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Checking ${email} in ${group} failed (${res.status}): ${await res.text()}`);
  const { isMember } = (await res.json()) as { isMember?: boolean };
  return isMember === true;
}
