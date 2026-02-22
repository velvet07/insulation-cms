# ThermoDesk

Full-stack CRM system for managing insulation projects — scheduling, material tracking, document generation, billing, and role-based access for contractors and subcontractors.

**Portfolio project** — built as a real-world demonstration of a complete business application.

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Strapi 5 CMS (headless, self-hosted)
- **Database:** PostgreSQL
- **Deployment:** VPS (PM2 + Nginx)

## Features

- Project lifecycle management (draft → scheduled → in progress → completed)
- Role-based access control (admin, main contractor, subcontractor)
- Document generation from DOCX templates (contracts, survey forms)
- Material inventory tracking with per-contractor balances
- Photo management with categorized uploads
- Calendar events tied to projects
- Billing records and project-level financials
- Excel project import
- ZIP export with structured folder layout
- Hungarian locale (HUF currency, date formats, UI language)

## Project Structure

```
insulation-crm/
├── frontend/              # Next.js frontend
│   ├── app/               # App Router pages (dashboard, projects, etc.)
│   ├── components/        # React components (shadcn/ui based)
│   ├── lib/               # API clients, utilities, hooks
│   └── types/             # TypeScript type definitions
├── src/                   # Strapi backend
│   ├── api/               # Content types, controllers, routes, services
│   └── extensions/        # Users-permissions customizations
├── config/                # Strapi configuration (database, server, plugins)
├── public/                # Static assets
└── database/              # SQLite (dev) / PostgreSQL (prod)
```

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Clone
git clone https://github.com/velvet07/insulation-cms.git
cd insulation-cms

# Backend (Strapi)
npm install
npm run develop
# → http://localhost:1337/admin

# Frontend (Next.js)
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Strapi API URL and token
npm run dev
# → http://localhost:3000
```

## License

MIT
