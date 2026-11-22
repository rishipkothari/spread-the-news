const REQUIRED = ["ANTHROPIC_API_KEY", "BLOB_READ_WRITE_TOKEN", "RUN_SECRET", "PLAYER_PASSWORD"] as const;
export type EnvName = (typeof REQUIRED)[number];

export function requireEnv(name: EnvName): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export function missingEnv(): string[] {
  return REQUIRED.filter((n) => !process.env[n]);
}
