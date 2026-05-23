export type LogLevel = "info" | "warn" | "error";

export interface LogEvent {
  readonly level: LogLevel;
  readonly event: string;
  readonly message: string;
  readonly details?: Record<string, string | number | boolean | null>;
}

export const logJson = (event: LogEvent): void => {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event });
  console.error(line);
};
