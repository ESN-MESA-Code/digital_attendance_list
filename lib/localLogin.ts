// "Local test sign-in" for `npm run dev:local`: Google sign-in cannot work
// against the local Supabase stack, so the login page offers the organiser
// from supabase/seed.sql instead. Only when the app was started with
// NEXT_PUBLIC_LOCAL_LOGIN=true AND talks to a Supabase on this machine – the
// seeded account does not exist anywhere else.

/** Test organiser from supabase/seed.sql (local stack only). */
export const LOCAL_ORGANISER_EMAIL = "organiser@esnmesa.org";

export function isLocalSupabaseUrl(url: string | undefined): boolean {
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url ?? "").hostname);
  } catch {
    return false;
  }
}

export function localLoginEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_LOCAL_LOGIN === "true" &&
    isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}
