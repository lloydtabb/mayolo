"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SAMPLE_URL =
  "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet";

type DatasetSummary = {
  id: string;
  name: string;
  sourceUrl: string;
  status: string;
  sizeBytes: number | null;
  createdAt: string;
  readyAt: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState(SAMPLE_URL);
  const [name, setName] = useState("yellow_taxi");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetSummary[] | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const r = await fetch("/api/datasets");
    if (!r.ok) return;
    setDatasets(await r.json());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: url, name }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `${res.status} ${res.statusText}`);
      }
      const { id } = await res.json();
      router.push(`/datasets/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 font-mono text-sm space-y-10">
      <header>
        <h1 className="text-2xl font-bold mb-2">mayolo</h1>
        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
          Point at a Parquet file. We pull it into blob storage, ask DuckDB
          for the schema, then have Claude write a Malloy semantic model. You
          get a personal MCP endpoint that any LLM can use to ask analytical
          questions of the data.
        </p>
      </header>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          1 — Ingest a dataset
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Source URL (Parquet)
            </span>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="https://…/file.parquet"
            />
          </label>

          <label className="block">
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Name (snake_case — this is what the LLM references in queries)
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="yellow_taxi"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Ingest"}
          </button>

          {error && (
            <pre className="text-red-600 dark:text-red-400 text-xs whitespace-pre-wrap mt-2">
              {error}
            </pre>
          )}
        </form>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            2 — Your datasets
          </h2>
          <button
            onClick={refresh}
            className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
          >
            refresh
          </button>
        </div>

        {datasets === null ? (
          <p className="text-gray-500 dark:text-gray-400 text-xs">loading…</p>
        ) : datasets.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-xs">
            No datasets yet. Submit one above.
          </p>
        ) : (
          <ul className="border border-gray-200 dark:border-gray-800 rounded divide-y divide-gray-200 dark:divide-gray-800">
            {datasets.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/datasets/${d.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {d.sizeBytes
                      ? `${(d.sizeBytes / 1024 / 1024).toFixed(1)} MiB`
                      : "—"}
                  </span>
                  <StatusBadge status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "ready"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : status === "failed"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs ${color}`}>
      {status}
    </span>
  );
}
