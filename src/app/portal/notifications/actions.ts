"use server";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPortalSession } from "@/lib/portal-session";
import { markPortalNotificationRead } from "@/lib/demo-store";
export async function markNotificationReadAction(id?: string) {
  const session=await getPortalSession();if(!session)notFound();
  if(!markPortalNotificationRead(session.participantId,id))notFound();
  revalidatePath('/portal/notifications');return {ok:true as const};
}
