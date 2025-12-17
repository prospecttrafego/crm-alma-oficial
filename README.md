# Alma CRM

## Overview

Alma CRM is a SaaS customer relationship management application built for the Alma digital agency. The platform provides two core features: a unified inbox for customer communications (multi-channel help desk style) and a Kanban-style sales pipeline for lead management. The application follows modern SaaS design patterns with a dark theme and purple accent color scheme.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 19 with TypeScript, using Vite 7 as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS 4 with CSS variables for theming (dark/light mode support)
- **Design System**: Custom theme following Alma brand guidelines with purple accent (#605be5)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript throughout
- **API Pattern**: RESTful API endpoints under `/api/*`
- **Real-time**: WebSocket support using the `ws` library for live updates
- **Authentication**: Passport.js Local Strategy with email/password, session-based with PostgreSQL session store
- **Storage**: Supabase Storage for file uploads

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod 4 schema validation (drizzle-zod)
- **Schema Location**: `shared/schema.ts` contains all database table definitions
- **Migrations**: Managed via Drizzle Kit (`drizzle-kit push`)

### Project Structure
```
├── client/src/          # React frontend application
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database access layer
│   ├── auth.ts          # Passport.js authentication setup
│   └── storage.supabase.ts # Supabase file storage
├── shared/              # Shared code between client and server
│   └── schema.ts        # Drizzle database schema
├── scripts/             # Utility scripts
│   └── migrate-users.ts # User migration helper
└── migrations/          # Database migrations
```

### Key Design Decisions

**Monorepo Structure**: Client and server share a single repository with shared types via the `shared/` directory, ensuring type safety across the stack.

**Component Library**: Uses shadcn/ui (New York style) which provides unstyled, accessible components that are copied into the project for full customization control.

**Authentication**: Uses Passport.js Local Strategy with bcrypt password hashing. Sessions are persisted in PostgreSQL via connect-pg-simple.

**File Storage**: Uses Supabase Storage for file uploads with signed URLs for secure access.

**Real-time Updates**: WebSocket connections broadcast changes to all connected clients, enabling live updates for pipeline changes and inbox messages.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage in PostgreSQL

### Storage
- **Supabase**: Object storage for file uploads (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

### Authentication
- **Passport.js**: Authentication middleware with Local Strategy
- **bcryptjs**: Password hashing

### Third-Party Libraries
- **Radix UI**: Headless UI primitives for accessible components
- **TanStack Query**: Server state management and caching
- **Drizzle ORM**: Type-safe database queries and schema management
- **Zod 4**: Runtime schema validation for API inputs
- **Lucide React**: Icon library
- **OpenAI**: AI-powered lead scoring and recommendations (optional)

### Development Tools
- **Vite 7**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **TypeScript 5.9**: Type checking across the entire codebase
- **Tailwind CSS 4**: Utility-first CSS framework

## Environment Variables

See `.env.example` for required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key (optional, for AI features)
- `ALLOW_REGISTRATION` - Enable/disable user registration

## Getting Started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in values
3. Push database schema: `npm run db:push`
4. Start development server: `npm run dev`
5. Build for production: `npm run build`
6. Start production server: `npm start`
