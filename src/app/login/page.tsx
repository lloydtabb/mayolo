"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/");
    } else {
      setError("wrong secret");
      setSecret("");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-mono text-sm">
      <form onSubmit={submit} className="space-y-4 w-full max-w-xs">
        <h1 className="text-xl font-bold">mayolo</h1>
        <label className="block">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            secret
          </span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoFocus
            required
            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </label>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 disabled:opacity-50"
        >
          {busy ? "checking…" : "sign in"}
        </button>
      </form>
    </main>
  );
}
