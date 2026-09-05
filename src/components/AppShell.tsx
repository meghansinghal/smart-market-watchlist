"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/apiClient";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { MarketSimulationModal } from "@/components/MarketSimulationModal";
import { UserSwitcher } from "@/components/UserSwitcher";

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-green-50 text-stone-900" : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      }`}
    >
      <span className={active ? "text-green-700" : "text-stone-400"}>{icon}</span>
      {label}
    </Link>
  );
}

/**
 * Persistent app frame: a brand mark + primary nav (Brief / Watchlist) on
 * the left, page content on the right. Every route renders inside this —
 * it's structural chrome, not page-specific state, which is why it lives
 * in the root layout rather than being duplicated per page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [simulationOpen, setSimulationOpen] = useState(false);
  const { userId, setUserId } = useCurrentUser();
  const { data: usersData } = useSWR("users", apiClient.getUsers);
  const users = usersData?.users ?? [];

  return (
    <div className="flex min-h-screen w-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white px-3 py-6">
        <div className="px-3 pb-6 font-mono text-xs font-bold tracking-wide text-stone-800 uppercase">
          What did
          <br />I miss
        </div>

        <nav className="flex flex-col gap-1">
          <NavLink
            href="/"
            label="Brief"
            active={pathname === "/"}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="2" fill="currentColor" />
              </svg>
            }
          />
          <NavLink
            href="/watchlist"
            label="Watchlist"
            active={pathname === "/watchlist"}
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 4h12M2 8h12M2 12h8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
        </nav>

        <div className="mt-auto flex flex-col gap-5 border-t border-stone-200 pt-4">
          <UserSwitcher users={users} currentUserId={userId} onChange={setUserId} />
          <button
            onClick={() => setSimulationOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <span aria-hidden>◆</span>
            Market simulation
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

      {simulationOpen && <MarketSimulationModal onClose={() => setSimulationOpen(false)} />}
    </div>
  );
}
