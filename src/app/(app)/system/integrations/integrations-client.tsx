"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plug, RefreshCw, Save, Settings2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/registry/shared";
import { syncIntegrationAction, updateIntegrationAction } from "./actions";
import type { IntegrationAdapter } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusStyle: Record<IntegrationAdapter["status"], string> = {
  connected: "border-success/30 bg-success-soft text-success",
  sandbox: "border-warning/30 bg-warning-soft text-warning",
  disconnected: "border-border bg-muted text-muted-foreground",
};

export function IntegrationsClient({
  adapters,
}: {
  adapters: IntegrationAdapter[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [status, setStatus] = useState<IntegrationAdapter["status"]>("connected");

  function startEdit(adapter: IntegrationAdapter) {
    setEditingId(adapter.id);
    setProvider(adapter.provider);
    setEndpoint(adapter.endpoint);
    setStatus(adapter.status);
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      const res = await updateIntegrationAction({ id, provider, endpoint, status });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Integration settings updated");
      setEditingId(null);
      router.refresh();
    });
  }

  function syncNow(id: string) {
    startTransition(async () => {
      const res = await syncIntegrationAction(id);
      if (res.ok) {
        toast.success(res.summary);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {adapters.map((adapter) => {
        const isEditing = editingId === adapter.id;
        return (
          <article key={adapter.id} className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-card">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    {adapter.status === "disconnected" ? <Unplug className="h-4.5 w-4.5" /> : <Plug className="h-4.5 w-4.5" />}
                  </span>
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {adapter.category}
                    </p>
                    <h2 className="text-sm font-semibold text-foreground">{adapter.name}</h2>
                  </div>
                </div>
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold capitalize", statusStyle[adapter.status])}>
                  {adapter.status === "connected" && <CheckCircle2 className="h-3 w-3" />}
                  {adapter.status}
                </span>
              </div>

              {isEditing ? (
                <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <Field label="Provider" htmlFor={`prov-${adapter.id}`}>
                    <Input id={`prov-${adapter.id}`} value={provider} onChange={(e) => setProvider(e.target.value)} />
                  </Field>
                  <Field label="Endpoint URI" htmlFor={`ep-${adapter.id}`}>
                    <Input id={`ep-${adapter.id}`} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="font-mono text-xs" />
                  </Field>
                  <Field label="Connection mode" htmlFor={`st-${adapter.id}`}>
                    <NativeSelect id={`st-${adapter.id}`} value={status} onChange={(e) => setStatus(e.target.value as IntegrationAdapter["status"])}>
                      <option value="connected">Connected (Live)</option>
                      <option value="sandbox">Sandbox / Staging</option>
                      <option value="disconnected">Disconnected</option>
                    </NativeSelect>
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" disabled={pending} onClick={() => saveEdit(adapter.id)}>
                      <Save className="mr-1.5 h-3.5 w-3.5" /> Save adapter
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-1.5 text-xs">
                  <p><span className="text-muted-foreground">Provider:</span> <span className="font-medium text-foreground">{adapter.provider}</span></p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{adapter.endpoint}</p>
                  <p className="pt-1 text-[11.5px] leading-relaxed text-muted-foreground">{adapter.lastSyncSummary}</p>
                </div>
              )}
            </div>

            {!isEditing && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Last check: {formatDateTime(adapter.lastSyncAt)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(adapter)} className="h-8 px-2.5 text-xs">
                    <Settings2 className="mr-1 h-3.5 w-3.5" /> Configure
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => syncNow(adapter.id)} className="h-8 px-2.5 text-xs">
                    <RefreshCw className={cn("mr-1 h-3.5 w-3.5", pending && "animate-spin")} /> Sync & test
                  </Button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
