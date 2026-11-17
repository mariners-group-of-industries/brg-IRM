import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getActiveCompanyId } from "@/lib/demo-auth";
import {
  listCompanies,
  listMeetings,
  listNotifications,
} from "@/lib/demo-store";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppHeader } from "@/components/shell/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const visible = listCompanies().filter(
    (company) =>
      session.role === "Platform Super Admin" ||
      session.companyIds.includes(company.id),
  );
  const cookieCompany = await getActiveCompanyId();
  const activeCompanyId =
    visible.find((c) => c.id === cookieCompany)?.id ?? visible[0]?.id ?? "";
  const visibleIds = new Set(visible.map((c) => c.id));
  const meetings = listMeetings().filter((m) => visibleIds.has(m.companyId));
  const notifications = listNotifications();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={session}
          companies={visible}
          activeCompanyId={activeCompanyId}
          meetings={meetings}
          notifications={notifications}
        />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
