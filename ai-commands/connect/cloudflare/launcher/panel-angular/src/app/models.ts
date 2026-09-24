export type Target = {
  providerId: string;
  configured?: boolean;
  connectorManaged?: boolean;
  connectorDesired?: boolean;
  connectorDetected?: boolean;
  serverOnline?: boolean;
  originHealthy?: boolean;
  accessHealthy?: boolean;
  publicUrl?: string;
  version?: string;
  message?: string;
  loading?: boolean;
  seenAt?: number;
};
export type Context = {
  profileId: string;
  workflow: string;
};
export type LogToken = {
  text: string;
  kind: string;
};
declare global {
  interface Window {
    cloudflareTunnel: {
      targets(): Promise<Target[]>;
      logs(): Promise<string[]>;
      contexts(): Promise<{
        contexts: Context[];
        selected?: Context;
      }>;
      selectContext(c: Context): Promise<{
        targets: Target[];
      }>;
      start(id: string): Promise<unknown>;
      stop(id: string): Promise<unknown>;
      openPublicUrl(id: string): Promise<unknown>;
      onLog(fn: (line: string) => void): void;
    };
  }
}
