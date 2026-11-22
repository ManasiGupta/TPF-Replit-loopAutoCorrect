import type { CallDetail } from "@workspace/api-client-react";
import raw from "@/data/connected-sample.json";

export interface SnapshotCriterion { id: string; name: string; text: string; source: string; passed: number; failed: number; unknown: number }
export interface ConnectedSnapshot {
  capturedAt: string;
  agent: { name: string; remoteId: string; platform: string; createdAt: string; criteriaCount: number; failedCriteriaCount: number | null; criteria: SnapshotCriterion[] };
  calls: CallDetail[];
}

export const snapshot = raw as ConnectedSnapshot;
