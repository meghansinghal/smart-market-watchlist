"use client";

import type { UserJSON } from "@/lib/apiTypes";

/** A plain demo-context switcher — not a login. Changing the selection
 * just changes which seeded user's watchlist/checkpoints subsequent
 * requests are scoped to. Lives in the sidebar (see AppShell) so it's
 * global to every page instead of duplicated per page header. */
export function UserSwitcher({
  users,
  currentUserId,
  onChange,
}: {
  users: UserJSON[];
  currentUserId: string | null;
  onChange: (userId: string) => void;
}) {
  if (users.length === 0) return null;

  return (
    <div className="px-3">
      <label className="block text-[10px] font-medium tracking-wide text-stone-400 uppercase">
        Viewing as
      </label>
      <select
        value={currentUserId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid="user-switcher"
        className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-medium text-stone-800 outline-none focus:border-stone-400"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}
