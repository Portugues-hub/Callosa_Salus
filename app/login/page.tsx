"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("recepcion@callosasalud.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      console.log("Supabase env en login:", {
        hasUrl: Boolean(supabaseUrl),
        hasAnonKey: Boolean(anonKey),
        url: supabaseUrl ?? null,
      });
      if (!supabaseUrl || !anonKey) {
        setError("Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        console.log("Supabase REST /token error:", payload);
        console.error("Supabase REST /token error:", payload);
        setError(payload?.error_description ?? payload?.msg ?? "Credenciales incorrectas.");
        return;
      }

      const accessToken = payload?.access_token as string | undefined;
      const expiresIn = Number(payload?.expires_in ?? 3600);
      if (!accessToken) {
        setError("No se recibió access_token de Supabase.");
        return;
      }

      document.cookie = `cs_access_token=${encodeURIComponent(accessToken)}; path=/; max-age=${expiresIn}; samesite=lax`;

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Error inesperado en login:", err);
      setError("No se pudo iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">CallosaSalud</h1>
          <p className="mt-1 text-sm text-slate-600">Acceso al panel recepcionista</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-400"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-400"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Iniciando..." : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}
