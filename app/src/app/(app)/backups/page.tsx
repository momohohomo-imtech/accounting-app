import { createClient } from "@/lib/supabase/server";
import { BackupNowButton } from "@/components/BackupNowButton";
import { BackupsTable } from "@/components/BackupsTable";
import { CalculatorsSection } from "@/components/CalculatorsSection";
import { TaxAgentAccountPanel } from "@/components/TaxAgentAccountPanel";
import { getTaxAgentAccounts } from "@/lib/actions/tax-agent";

export default async function BackupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const [{ data: backups }, taxAgentAccounts] = await Promise.all([
    supabase.from("backups").select("*").order("created_at", { ascending: false }),
    isAdmin ? getTaxAgentAccounts() : Promise.resolve([]),
  ]);

  const withLinks = await Promise.all(
    (backups ?? []).map(async (b) => {
      if (!b.storage_url) return { ...b, signedUrl: null };
      try {
        const { data } = await supabase.storage.from("backups").createSignedUrl(b.storage_url, 3600);
        return { ...b, signedUrl: data?.signedUrl ?? null };
      } catch {
        return { ...b, signedUrl: null };
      }
    })
  );

  return (
    <div className="space-y-6">
      <CalculatorsSection />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">백업</h1>
        <BackupNowButton />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto">
          <BackupsTable backups={withLinks} />
        </div>
      </div>

      {isAdmin && (
        <TaxAgentAccountPanel accounts={taxAgentAccounts} adminApiConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} />
      )}
    </div>
  );
}
