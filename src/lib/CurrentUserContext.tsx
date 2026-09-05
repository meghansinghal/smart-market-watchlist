"use client";

import { createContext, useContext, type ReactNode } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { apiClient } from "@/lib/apiClient";

const STORAGE_KEY = "wdim.currentUserId";
const SWR_KEY = "current-user-id";

function readStoredUserId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled — fall back to no selection.
    return null;
  }
}

interface CurrentUserContextValue {
  userId: string | null;
  setUserId: (id: string) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

/**
 * Tracks which seeded demo user the app is "acting as" — a plain client-
 * side selection persisted to localStorage, NOT a session or auth token.
 * There's no server-side notion of "who's logged in"; every API call just
 * carries this id explicitly so the server can scope reads/writes to the
 * right user's watchlist and checkpoints.
 *
 * The effective userId is a pure derived value — the explicitly stored
 * selection if there is one, otherwise the first seeded user — rather
 * than something assigned imperatively in an effect. That's what makes it
 * work correctly no matter which page mounts first (dashboard or a stock
 * detail page reached by a direct link), with no bootstrapping step to
 * remember to duplicate.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { data: storedUserId } = useSWR(SWR_KEY, readStoredUserId, { fallbackData: null });
  const { data: usersData } = useSWR("users", apiClient.getUsers);
  const userId = storedUserId ?? usersData?.users[0]?.id ?? null;

  function setUserId(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ignore — the in-memory value below still switches for this session.
    }
    globalMutate(SWR_KEY, id, { revalidate: false });
  }

  return (
    <CurrentUserContext.Provider value={{ userId, setUserId }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  return ctx;
}
