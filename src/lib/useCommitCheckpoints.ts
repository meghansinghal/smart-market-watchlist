import { useEffect, useRef } from "react";
import { apiClient } from "@/lib/apiClient";
import type { DashboardResponse } from "@/lib/apiTypes";

// Module-level (not per-component) so that navigating between the Brief
// and Watchlist pages — both rendering the same dashboard fetch — doesn't
// re-commit the same brief twice just because each page mounts its own
// effect instance.
const committedGeneratedAt = new Map<string, string>();

/**
 * Once a dashboard brief has actually been rendered, tell the server
 * "this user has now seen this" so next visit's comparison baseline moves
 * forward. Shared by every page that renders the dashboard brief, so
 * whichever one a user lands on first still acknowledges it.
 *
 * Commits only once per mount (per user). A page can stay mounted while its
 * dashboard data silently revalidates underneath it — e.g. the Watchlist
 * page stays mounted behind the Market Simulation modal, whose scenario
 * changes invalidate the shared SWR cache — and none of that is the user
 * actually "visiting" again. Treating every such revalidation as a fresh
 * visit would ack a meaningful change before the user ever saw it.
 */
export function useCommitCheckpoints(dashboard: DashboardResponse | undefined, userId: string | null) {
  const hasCommittedThisMount = useRef(false);

  // A user switch (via the in-page switcher, not a navigation/remount) is
  // its own new "visit" and should be free to commit again.
  useEffect(() => {
    hasCommittedThisMount.current = false;
  }, [userId]);

  useEffect(() => {
    if (!dashboard || !userId || hasCommittedThisMount.current) return;
    hasCommittedThisMount.current = true;
    if (committedGeneratedAt.get(userId) === dashboard.generatedAt) return;
    committedGeneratedAt.set(userId, dashboard.generatedAt);
    // "OK" means we compared against a prior checkpoint; "NEW" means this
    // symbol has none yet. Both are checkpoint-worthy — NEW is exactly how
    // a freshly added symbol gets its first baseline established.
    const items = dashboard.items
      .filter(
        (item) =>
          (item.change?.dataStatus === "OK" || item.change?.dataStatus === "NEW") && item.observation,
      )
      .map((item) => ({ symbol: item.symbol, observationId: item.observation!.id }));
    if (items.length > 0) {
      apiClient.commitCheckpoints(userId, items).catch(() => {
        // Best-effort acknowledgement; next load will retry naturally.
      });
    }
  }, [dashboard, userId]);
}
