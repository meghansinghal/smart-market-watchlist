"use client";

import type { UserJSON } from "@/lib/apiTypes";

/** A plain demo-context switcher — not a login. Changing the selection
 * just changes which seeded user's watchlist/checkpoints subsequent
 * requests are scoped to. */
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
    <label className="flex items-center gap-1.5 text-sm text-stone-500">
      <span className="text-xs font-medium tracking-wide text-stone-400 uppercase">Viewing as</span>
      <select
        value={currentUserId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid="user-switcher"
        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm font-medium text-stone-800 outline-none focus:border-stone-400"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}
