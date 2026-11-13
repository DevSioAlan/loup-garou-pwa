import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const LOCAL_UUID_KEY = "lune_de_sang_player_uuid_v1";

export interface PlayerIdentity {
  userId: string;
  source: "supabase_anon" | "local_uuid";
}

function getOrCreateLocalUuid(): string {
  if (typeof window === "undefined") {
    return "server-placeholder";
  }
  try {
    const existing = window.localStorage.getItem(LOCAL_UUID_KEY);
    if (existing && existing.length > 8) {
      return existing;
    }
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(LOCAL_UUID_KEY, created);
    return created;
  } catch {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Identifie le téléphone sans friction via supabase.auth.signInAnonymously(),
 * avec repli automatique sur un UUID local persistant si l'auth anonyme est désactivée.
 */
export async function ensurePlayerIdentity(): Promise<PlayerIdentity> {
  if (!isSupabaseConfigured()) {
    return { userId: getOrCreateLocalUuid(), source: "local_uuid" };
  }

  try {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData.session?.user?.id) {
      return {
        userId: sessionData.session.user.id,
        source: "supabase_anon",
      };
    }

    const { data: anonData, error } = await supabase.auth.signInAnonymously();
    if (!error && anonData.user?.id) {
      return {
        userId: anonData.user.id,
        source: "supabase_anon",
      };
    }
  } catch {
    // Repli silencieux sur l'UUID local
  }

  return { userId: getOrCreateLocalUuid(), source: "local_uuid" };
}
