"use client";
import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setPortalLocaleAction } from "@/app/portal/language-actions";
import { portalTranslator, type PortalLocale } from "@/lib/portal-i18n";
const LocaleContext = createContext<PortalLocale>("en");
export function PortalLanguageProvider({locale,children}:{locale:PortalLocale;children:ReactNode}) { return <LocaleContext.Provider value={locale}><div lang={locale === "bn" ? "bn" : "en"}>{children}</div></LocaleContext.Provider>; }
export function usePortalLanguage() { const locale=useContext(LocaleContext);return {locale,t:portalTranslator(locale),number:(n:number)=>new Intl.NumberFormat(locale==='bn'?'bn-BD':'en-BD').format(n)}; }
export function PortalLanguageSwitch(){const{locale}=usePortalLanguage();const[pending,startTransition]=useTransition();const router=useRouter();return <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs" aria-label="Language / ভাষা">{(['en','bn'] as const).map(value=><button key={value} type="button" lang={value} aria-pressed={locale===value} disabled={pending} onClick={()=>startTransition(async()=>{await setPortalLocaleAction(value);router.refresh();})} className={`rounded-md px-2.5 py-1 text-xs font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#0C9488] disabled:opacity-50 ${locale===value?'bg-[#0C9488] text-white shadow-xs':'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>{value==='en'?'EN':'বাংলা'}</button>)}</div>;}
