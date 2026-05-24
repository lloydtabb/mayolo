import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { verifyAuthz } from "@/lib/oauth/authz-blob";
import { getOAuthClient } from "@/lib/oauth/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ t?: string }>;
}

export default async function ConsentPage({ searchParams }: PageProps) {
  const { t } = await searchParams;
  if (!t) return <ErrorScreen message="Missing authorization request token." />;

  const authz = verifyAuthz(t);
  if (!authz) return <ErrorScreen message="This authorization request has expired or is invalid. Please retry from your client." />;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/oauth/consent?t=${t}`)}`);
  }
  if (session.user.id !== authz.userId) return <ErrorScreen message="Session mismatch. Please retry the authorization from your client." />;

  const client = await getOAuthClient(authz.clientId);
  if (!client) return <ErrorScreen message="The requesting client is no longer registered." />;

  let redirectHost = "";
  try { redirectHost = new URL(authz.redirectUri).host; } catch { redirectHost = authz.redirectUri; }

  return (
    <main className="mx-auto max-w-md px-6 py-16 font-mono text-sm space-y-6">
      <h1 className="text-xl font-bold">Authorize {client.name}</h1>
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
        <span className="font-semibold">{client.name}</span> wants to access
        your malloyyo datasets through the MCP server.
      </p>
      <section className="rounded border border-gray-200 dark:border-gray-800 p-4 space-y-2 text-xs">
        <div><span className="text-gray-500 dark:text-gray-400">Scope:</span> <code>{authz.scope}</code></div>
        <div><span className="text-gray-500 dark:text-gray-400">Redirects back to:</span> <code className="break-all">{redirectHost}</code></div>
        <div><span className="text-gray-500 dark:text-gray-400">Signed in as:</span> {session.user.email ?? session.user.name}</div>
      </section>
      <form action="/api/oauth/authorize/decide" method="POST" className="flex gap-3">
        <input type="hidden" name="t" value={t} />
        <button type="submit" name="action" value="deny"
          className="flex-1 rounded border border-gray-300 dark:border-gray-700 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-900">
          Deny
        </button>
        <button type="submit" name="action" value="approve"
          className="flex-1 rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2">
          Allow
        </button>
      </form>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-md px-6 py-16 font-mono text-sm space-y-4">
      <h1 className="text-xl font-bold">Authorization request</h1>
      <p className="text-gray-700 dark:text-gray-300">{message}</p>
    </main>
  );
}
