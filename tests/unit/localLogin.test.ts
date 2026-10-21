// Security: the local test sign-in must never be offered against a real project.
import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalSupabaseUrl, localLoginEnabled } from "@/lib/localLogin";

afterEach(() => vi.unstubAllEnvs());

describe("isLocalSupabaseUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])("%s is local", (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(true);
  });

  it.each([
    "https://abcdefgh.supabase.co",
    "https://127.0.0.1.evil.example",
    "https://localhost.evil.example",
    "not a url",
    "",
    undefined,
  ])("%s is not local", (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });
});

describe("localLoginEnabled", () => {
  it("needs the flag and a local Supabase", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_LOCAL_LOGIN", "true");
    expect(localLoginEnabled()).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_LOCAL_LOGIN", "");
    expect(localLoginEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_LOCAL_LOGIN", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
    expect(localLoginEnabled()).toBe(false);
  });
});
