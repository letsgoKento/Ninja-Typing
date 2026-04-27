import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { sanitizePlayerName } from "@/types/leaderboard";

export function getAuthRedirectUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (configuredSiteUrl) {
    return `${configuredSiteUrl}/auth/callback`;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}/auth/callback`;
}

export function getFallbackUsername(session: Session | null) {
  const metadataName = sanitizePlayerName(String(session?.user.user_metadata?.username ?? ""));

  if (metadataName) {
    return metadataName.slice(0, 20);
  }

  return sanitizePlayerName(session?.user.email?.split("@")[0] ?? "SHINOBI").slice(0, 20);
}

export async function upsertProfile(session: Session, username: string) {
  const supabase = getSupabaseClient();
  const cleanUsername = sanitizePlayerName(username || getFallbackUsername(session)).slice(0, 20);

  if (!supabase || !cleanUsername) {
    return cleanUsername;
  }

  await supabase.from("profiles").upsert(
    {
      id: session.user.id,
      username: cleanUsername,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  return cleanUsername;
}

export async function loadProfileUsername(session: Session | null) {
  const supabase = getSupabaseClient();

  if (!supabase || !session) {
    return "";
  }

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
  const username = sanitizePlayerName(String(profile?.username ?? getFallbackUsername(session))).slice(0, 20);

  if (!profile?.username) {
    await upsertProfile(session, username);
  }

  return username;
}
