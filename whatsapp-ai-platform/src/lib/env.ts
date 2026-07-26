import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:5173",
  jwtSecret: required("JWT_SECRET", "dev-insecure-secret-change-me"),
  jwtExpires: process.env.JWT_EXPIRES || "12h",
  graphVersion: process.env.META_GRAPH_VERSION || "v21.0",
  // Meta app used for Embedded Signup. Tenants may override these in Settings.
  metaAppId: process.env.META_APP_ID || "",
  metaAppSecret: process.env.META_APP_SECRET || "",
  metaConfigId: process.env.META_CONFIG_ID || "",
  /** Public origin Meta should call back — needed for the webhook URL. */
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || "4000"}`,
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  openaiKey: process.env.OPENAI_API_KEY || "",
};

export const isDev = env.nodeEnv === "development";
