export type ConversationStatus = "idle" | "ready" | "sending" | "waiting" | "error";

/** Local conversation session for one provider tab. */
export interface ConversationState {
  id: string;
  providerId: string;
  tabId: number;
  projectName: string | null;
  snapshotId: string | null;
  status: ConversationStatus;
  updatedAt: string;
  lastError?: string;
}
