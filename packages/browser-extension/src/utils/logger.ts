export type LogScope =
  | "Bridge"
  | "Provider"
  | "DOM"
  | "Popup"
  | "Workflow"
  | "Debug"
  | "Background"
  | "Content";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  scope: LogScope;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface LoggerOptions {
  debugMode?: boolean;
  sink?: (entry: LogEntry) => void;
}

/**
 * Structured logger with scopes. Debug-level entries are suppressed unless
 * debugMode is enabled.
 */
export class Logger {
  private debugMode: boolean;
  private readonly sink: (entry: LogEntry) => void;

  constructor(options: LoggerOptions = {}) {
    this.debugMode = options.debugMode ?? false;
    this.sink =
      options.sink ??
      ((entry) => {
        const prefix = `[AI-Bridge:${entry.scope}]`;
        const payload = entry.data ? [prefix, entry.message, entry.data] : [prefix, entry.message];
        switch (entry.level) {
          case "error":
            console.error(...payload);
            break;
          case "warn":
            console.warn(...payload);
            break;
          case "debug":
            console.debug(...payload);
            break;
          default:
            console.info(...payload);
        }
      });
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  child(scope: LogScope): ScopedLogger {
    return new ScopedLogger(this, scope);
  }

  log(
    scope: LogScope,
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (level === "debug" && !this.debugMode) return;
    const entry: LogEntry = {
      scope,
      level,
      message,
      timestamp: new Date().toISOString(),
    };
    if (data !== undefined) {
      entry.data = data;
    }
    this.sink(entry);
  }
}

export class ScopedLogger {
  constructor(
    private readonly root: Logger,
    private readonly scope: LogScope,
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.root.log(this.scope, "debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.root.log(this.scope, "info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.root.log(this.scope, "warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.root.log(this.scope, "error", message, data);
  }
}

/** Shared process-wide logger instance (safe in each extension context). */
export const rootLogger = new Logger();
