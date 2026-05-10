import { Sidebar } from "@/components/nav/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
