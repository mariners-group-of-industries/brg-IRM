import { getPortalSession } from "@/lib/portal-session";
import { portalNotifications } from "@/lib/demo-store";
export async function GET(){const session=await getPortalSession();if(!session)return Response.json({error:'Not signed in'},{status:401});return Response.json({notifications:portalNotifications(session.participantId)},{headers:{'Cache-Control':'private, no-store'}});}
