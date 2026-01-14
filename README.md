# Padlásfödém Szigetelés CRM

Komplex CRM rendszer padlásfödém szigetelési projektek kezelésére.

## 🚀 Tech Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Strapi CMS (Self-Hosted)
- **Deployment:** Self-Hosted VPS (PM2 + Nginx)

## 📁 Projekt Struktúra

```
insulation-crm/
├── frontend/              # Next.js frontend
│   ├── app/              # App Router pages
│   ├── components/        # React komponensek
│   ├── lib/              # Utilities, API clients
│   └── types/            # TypeScript típusok
├── strapi-export/         # Strapi API fájlok (schemas, routes, controllers, services)
├── docs/                  # Dokumentáció
└── deploy.sh              # Deployment script
```

## 🛠️ Development Setup

### Előfeltételek

- Node.js 20+
- npm vagy yarn

### Lokális Fejlesztés

```bash
# 1. Projekt klónozása
git clone <repo-url>
cd insulation-crm

# 2. Frontend függőségek telepítése
cd frontend
npm install

# 3. Environment változók beállítása
cp .env.example .env.local
# Szerkeszd a .env.local fájlt és add hozzá a Strapi API token-t

# 4. Development szerver indítása
npm run dev
```

A frontend elérhető: `http://localhost:3000`

## 📦 Deployment

Részletes deployment útmutató: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

### Gyors Deploy

```bash
# Szerveren
./deploy.sh
```

## 📚 Dokumentáció

- [Teljes Projekt Terv](docs/PADLASFODERM_CRM_PROJECT_PLAN.md)
- [Fejlesztési Útmutató](docs/DEVELOPMENT_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Strapi Setup](docs/STRAPI_STATUS.md)

## 🔗 Linkek

- **Strapi Backend:** https://cms.emermedia.eu
- **Strapi Admin:** https://cms.emermedia.eu/admin
- **Frontend (Production):** https://app.emermedia.eu (vagy más domain)

## 📝 License

Private project
