"use client";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { usePortalLanguage } from "./language-provider";
import { Button } from "@/components/ui/button";
import { portalMeetingDate } from "@/lib/portal-format";
import type { MeetingDocument } from "@/lib/types";
export function PortalDocuments({documents}:{documents:(Omit<MeetingDocument,'content'|'text'>&{bytes:number})[]}){const{t,locale}=usePortalLanguage();return <><ul className="divide-y divide-border rounded-xl border border-border bg-card">{documents.map(d=><li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex min-w-0 items-start gap-3"><FileText className="mt-1 size-5 shrink-0 text-brand" aria-hidden/><div><p className="text-sm font-medium">{t(d.title)}</p><p className="mt-1 text-xs text-muted-foreground">{t(d.kind)} · {Math.ceil(d.bytes/1024)} KB{d.publishedAt?` · ${portalMeetingDate(d.publishedAt,undefined,locale)}`:''}</p></div></div><div className="flex gap-2"><Button nativeButton={false} variant="outline" render={<Link href={`/portal/documents/${d.id}`}/>}>{t('Read')}</Button><Button nativeButton={false} variant="ghost" render={<a href={`/api/documents/${d.id}?download=1`}/>}><Download/>{t('Download')}</Button></div></li>)}</ul>{!documents.length&&<p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">{t('No published documents')}</p>}</>;}
