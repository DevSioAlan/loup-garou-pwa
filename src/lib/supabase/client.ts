import { createBrowserClient } from "@supabase/ssr";

/**
 * Lit l'URL et la clé publique Supabase depuis l'environnement client.
 * Accepte NEXT_PUBLIC_SUPABASE_ANON_KEY ainsi que NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Vercel/Supabase).
 */
export function getSupabaseClientEnv(): {
  url: string | undefined;
  anonKey: string | undefined;
} {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * Retourne un préfixe discret du projet Supabase actif (ex: "nmjkap...")
 * pour diagnostiquer immédiatement vers quel backend pointe le build courant.
 */
export function getSupabaseProjectRefPrefix(): string {
  const { url } = getSupabaseClientEnv();
  if (!url) return "absent";

  try {
    const hostname = new URL(url).hostname;
    const ref = hostname.split(".")[0] || hostname;
    return ref.length > 6 ? `${ref.slice(0, 6)}...` : ref;
  } catch {
    return `${url.slice(0, 14)}...`;
  }
}

/**
 * Vérifie si les variables d'environnement Supabase sont configurées.
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseClientEnv();
  return Boolean(url && anonKey);
}

/**
 * Crée un client Supabase côté navigateur (Auth, Realtime, Storage).
 */
export function createClient() {
  const { url, anonKey } = getSupabaseClientEnv();

  if (!url || !anonKey) {
    throw new Error(
      "Variables Supabase manquantes : configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)."
    );
  }

  return createBrowserClient(url, anonKey, {
    db: { schema: "public" },
  });
}
