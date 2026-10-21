// Access to the local Supabase stack (`npx supabase start`) for the DB and
// end-to-end tests. The keys are the fixed, public demo keys of every local
// Supabase stack – never production credentials.
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE_ROLE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const JWT_SECRET =
  process.env.TEST_SUPABASE_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";

/** Organisers created by supabase/seed.sql. */
export const ORGANISER = { email: "organiser@esnmesa.org", password: "local-test-password" };
/** Only for the sign-out test: signing out ends all of a user's sessions. */
export const SIGNOUT_ORGANISER = { email: "signout@esnmesa.org", password: "local-test-password" };

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

/** A client acting as `accessToken` (REST and realtime). */
export async function clientAs(accessToken: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  await client.realtime.setAuth(accessToken);
  return client;
}

/** Signs in a seeded organiser; returns the full Supabase session. */
export async function organiserSession(who = ORGANISER) {
  const { data, error } = await anonClient().auth.signInWithPassword(who);
  if (error || !data.session) throw error ?? new Error("no session");
  return data.session;
}

/**
 * A JWT signed with the local stack's secret for a user that does not exist
 * in auth.users – PostgREST and realtime accept it (they only check the
 * signature), Supabase Auth does not. Use it for "what if someone got a
 * token for another account" checks.
 */
export function forgedJwt(email: string, provider = "google") {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: crypto.randomUUID(),
    role: "authenticated",
    aud: "authenticated",
    email,
    app_metadata: { provider },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export interface TestEvent {
  id: string;
  public_token: string;
  title: string;
}

/** Creates an event with a random token (as the service role, so no creator unless given). */
export async function createEvent(
  title = `Test event ${crypto.randomUUID().slice(0, 8)}`,
  createdBy: string | null = null,
  extra: object = {}
) {
  const { data, error } = await admin
    .from("events")
    .insert({
      title,
      description: "Created by the test suite",
      event_date: new Date().toISOString(),
      responsible_member: "Rita Responsible",
      lei_responsible: "Lea LEI",
      public_token: crypto.randomUUID().replace(/-/g, ""),
      created_by: createdBy,
      ...extra,
    })
    .select("id, public_token, title")
    .single();
  if (error) throw error;
  return data as TestEvent;
}

/** Signs an event off as the service role (as if its organiser had). */
export async function signOffEvent(id: string, signature: string, by = ORGANISER.email) {
  const { error } = await admin
    .from("events")
    .update({ signed_off_at: new Date().toISOString(), signed_off_by: by, organiser_signature: signature })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEvent(id: string) {
  await admin.from("events").delete().eq("id", id);
}

/** A valid participant row for `eventId` (self sign-in). */
export function participantRow(eventId: string, signature: string, extra: object = {}) {
  return {
    event_id: eventId,
    first_name: "Max",
    last_name: "Mustermann",
    nationality: "IT",
    university: "TUM",
    exchange_program: "Erasmus+",
    esn_card: false,
    signature,
    consent_version: "2026-10-21",
    ...extra,
  };
}

/**
 * The @supabase/ssr auth cookies for a session on the app's origin, chunked
 * the way the library writes them.
 */
export function sessionCookies(session: object, baseURL: string) {
  const name = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const CHUNK = 3180;
  const parts =
    value.length <= CHUNK
      ? [{ name, value }]
      : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, i) => ({
          name: `${name}.${i}`,
          value: value.slice(i * CHUNK, (i + 1) * CHUNK),
        }));
  return parts.map((p) => ({ ...p, url: baseURL, sameSite: "Lax" as const }));
}
