import { assessDataStatus } from "@/server/services/changeEngine";
import { checkpointRepository } from "@/server/repositories/checkpointRepository";
import { observationRepository } from "@/server/repositories/observationRepository";

export interface CommitRequestItem {
  symbol: string;
  observationId: string;
}

export interface CommitOutcome {
  symbol: string;
  committed: boolean;
  reason?: string;
}

/**
 * "Only after successful acknowledgement, update the checkpoint with valid
 * current observations." The dashboard computes the brief from freshly
 * fetched observations but never checkpoints them itself — the client
 * calls this only once the brief has actually been rendered, and even then
 * each observation is independently re-validated here (by id, against the
 * DB) before it's allowed to become the new "what this user last saw".
 * Every commit is scoped to a single userId — one user's commit can never
 * touch another user's checkpoint row, since the underlying repository
 * writes are keyed by (userId, symbol).
 */
export const checkpointService = {
  async commit(userId: string, items: CommitRequestItem[]): Promise<CommitOutcome[]> {
    const now = new Date();
    const outcomes: CommitOutcome[] = [];

    for (const item of items) {
      const observation = await observationRepository.getById(item.observationId);
      if (!observation || observation.symbol !== item.symbol) {
        outcomes.push({ symbol: item.symbol, committed: false, reason: "observation not found" });
        continue;
      }
      const status = assessDataStatus(observation, now);
      if (status !== "OK") {
        outcomes.push({
          symbol: item.symbol,
          committed: false,
          reason: `data not fresh enough to checkpoint (${observation.freshness})`,
        });
        continue;
      }
      await checkpointRepository.set(userId, observation);
      outcomes.push({ symbol: item.symbol, committed: true });
    }

    return outcomes;
  },
};
