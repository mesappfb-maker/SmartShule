# SmartShule (SS)

> **Slogan :** *SmartShule — L'intelligence qui rapproche l'école et la famille.*

Système intégré de gestion scolaire, administrative et commerciale.

## 🚀 Démarrage rapide

```bash
# Installation
bun install

# Base de données
bun run db:push
bun run scripts/seed.ts
bun run scripts/seed-accounting.ts

# Démarrage
bun run dev
# → http://localhost:3000
```

## 🔐 Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Direction | direction@smartshule.demo | SmartShule2026! |
| Parent | parent1@smartshule.demo | SmartShule2026! |
| Élève | eleve1@smartshule.demo | SmartShule2026! |

## 📚 Documentation

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Déploiement Cloudflare + Render + GitHub Actions
- [`smartshule-progress-log.md`](./smartshule-progress-log.md) — Journal de bord complet (8 cycles)

## 🧪 Tests

```bash
bun test          # 150 tests
bun run lint      # ESLint
```

## 📦 Stack technique

- **Next.js 16** (App Router) + **TypeScript 5**
- **Prisma 6** + **SQLite**
- **Tailwind CSS 4** + **shadcn/ui**
- **Electron** (build .exe Windows via GitHub Actions)
- 150 tests unitaires + intégration DB (376 assertions)

## 📋 Modules livrés

| Module | Statut | Tests |
|---|---|---:|
| Auth + RBAC + Audit (P0) | ✅ | 35 |
| Finance & Comptabilité double entrée (P1) | ✅ | 54 |
| Appel + Notes workflow (P1) | ✅ | 29 |
| Exports PDF/XLSX/CSV (P1) | ✅ | 8 |
| Locations salles & véhicules (P2) | ✅ | 18 |
| Bibliothèque + Transport + Cantine (P2) | ✅ | 6 |
| **Total** | | **150** |

## 📄 Licence

MIT — Copyright © 2025-2026 SmartShule
