import { rootLogger } from "../utils/logger";

/**
 * Local-only telemetry contract. Implementations must not send data
 * to external analytics services.
 */
export interface Telemetry {
  trackWorkflow(
    commandId: string,
    data?: Record<string, unknown>,
  ): void;
  trackProvider(
    providerId: string,
    data?: Record<string, unknown>,
  ): void;
  trackBridge(
    event: string,
    data?: Record<string, unknown>,
  ): void;
  trackPerformance(
    metric: string,
    durationMs: number,
    data?: Record<string, unknown>,
  ): void;
}

/** Logs structured events locally via the extension logger. */
export class LocalTelemetry implements Telemetry {
  private readonly log = rootLogger.child("Debug");

  trackWorkflow(commandId: string, data?: Record<string, unknown>): void {
    this.log.info("telemetry.workflow", { commandId, ...data });
  }

  trackProvider(providerId: string, data?: Record<string, unknown>): void {
    this.log.info("telemetry.provider", { providerId, ...data });
  }

  trackBridge(event: string, data?: Record<string, unknown>): void {
    this.log.info("telemetry.bridge", { event, ...data });
  }

  trackPerformance(
    metric: string,
    durationMs: number,
    data?: Record<string, unknown>,
  ): void {
    this.log.info("telemetry.performance", { metric, durationMs, ...data });
  }
}

export const telemetry: Telemetry = new LocalTelemetry();
