"use client";
import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setPortalLocaleAction } from "@/app/portal/language-actions";
import { portalTranslator, type PortalLocale } from "@/lib/portal-i18n";
const LocaleContext = createContext<PortalLocale>("en");
export function PortalLanguageProvider({locale,children}:{locale:PortalLocale;children:ReactNode}) { return <LocaleContext.Provider value={locale}><div lang={locale === "bn" ? "bn" : "en"}>{children}</div></LocaleContext.Provider>; }
export function usePortalLanguage() { const locale=useContext(LocaleContext);return {locale,t:portalTranslator(locale),number:(n:number)=>new Intl.NumberFormat(locale==='bn'?'bn-BD':'en-BD').format(n)}; }
export function PortalLanguageSwitch(){const{locale}=usePortalLanguage();const[pending,startTransition]=useTransition();const router=useRouter();return <div className="inline-flex shrink-0 rounded-md border border-border bg-card p-0.5" aria-label="Language / ভাষা">{(['en','bn'] as const).map(value=><button key={value} type="button" lang={value} aria-pressed={locale===value} disabled={pending} onClick={()=>startTransition(async()=>{await setPortalLocaleAction(value);router.refresh();})} className={`rounded px-2 py-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${locale===value?'bg-brand-soft text-brand':'text-muted-foreground hover:bg-muted'}`}>{value==='en'?'EN':'বাংলা'}</button>)}</div>;}
