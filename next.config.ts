import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // ============================================================
  // Configuration des origines autorisées (Server Actions)
  // ============================================================
  // Next.js 16 valide que l'en-tête `origin` des Server Actions correspond
  // au `x-forwarded-host`. Derrière un reverse proxy (Caddy, gateway de
  // preview, Cloudflare), ces en-têtes diffèrent et les actions sont bloquées.
  // `allowedDevOrigins` autorise explicitement les hôtes externes.
  allowedDevOrigins: [
    "preview-chat-efec7381-c051-45a4-a204-859d1a736b1a.space-z.ai",
    "*.space-z.ai",
    "localhost:3000",
    "127.0.0.1:3000",
    // Patterns génériques pour les environnements de preview
    "*.cn-hongkong-vpc.fcapp.run",
    "*.onrender.com",
    "*.pages.dev",
  ],

  // Configuration des Server Actions
  experimental: {
    serverActions: {
      // Autoriser les origines externes pour les Server Actions
      allowedOrigins: [
        "preview-chat-efec7381-c051-45a4-a204-859d1a736b1a.space-z.ai",
        "*.space-z.ai",
        "*.cn-hongkong-vpc.fcapp.run",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
