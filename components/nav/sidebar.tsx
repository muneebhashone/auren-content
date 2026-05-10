"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Briefcase,
  Target,
  Users,
  FileText,
  BarChart3,
  BookOpen,
  Settings,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups: { label: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    label: "Content",
    items: [
      { href: "/", label: "Calendar", icon: Calendar },
      { href: "/rewrite", label: "Rewrite", icon: Wand2 },
      { href: "/performance", label: "Performance", icon: BarChart3 },
    ],
  },
  {
    label: "Strategy",
    items: [
      { href: "/strategy/business", label: "Business Profile", icon: Briefcase },
      { href: "/strategy/goals", label: "Quarterly Goals", icon: Target },
      { href: "/strategy/personas", label: "Personas", icon: Users },
      { href: "/strategy/story-bank", label: "Story Bank", icon: BookOpen },
      { href: "/strategy/brief", label: "Weekly Brief", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-bg-elevated flex flex-col">
      <div className="flex items-center gap-2 px-5 h-14 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-accent-fg" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Auren</span>
          <span className="text-[10px] text-fg-subtle uppercase tracking-widest">
            Content OS
          </span>
        </div>
      </div>
      <nav className="flex-1 p-3 flex flex-col gap-6 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle px-3 mb-1">
              {group.label}
            </div>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-bg-overlay text-fg"
                      : "text-fg-muted hover:text-fg hover:bg-bg-overlay/60"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-5 py-3 border-t border-border text-[11px] text-fg-subtle leading-relaxed">
        AurenStudios &middot; Content Strategy
        <br />
        Single-user mode
      </div>
    </aside>
  );
}
