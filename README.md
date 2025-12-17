# Alma CRM

## Overview

Alma CRM is a SaaS customer relationship management application built for the Alma digital agency. The platform provides two core features: a unified inbox for customer communications (multi-channel help desk style) and a Kanban-style sales pipeline for lead management. The application follows modern SaaS design patterns with a dark theme and purple accent color scheme.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark/light mode support)
- **Design System**: Custom theme following Alma brand guidelines with purple accent (#605be5)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript throughout
- **API Pattern**: RESTful API endpoints under `/api/*`
- **Real-time**: WebSocket support using the `ws` library for live updates
- **Authentication**: Replit Auth with OpenID Connect, session-based with PostgreSQL session store

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod schema validation (drizzle-zod)
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
│   └── replitAuth.ts    # Authentication setup
├── shared/              # Shared code between client and server
│   └── schema.ts        # Drizzle database schema
└── migrations/          # Database migrations
```

### Key Design Decisions

**Monorepo Structure**: Client and server share a single repository with shared types via the `shared/` directory, ensuring type safety across the stack.

**Component Library**: Uses shadcn/ui (New York style) which provides unstyled, accessible components that are copied into the project for full customization control.

**Authentication**: Leverages Replit's built-in authentication system with session persistence in PostgreSQL, avoiding the need for custom auth implementation.

**Real-time Updates**: WebSocket connections broadcast changes to all connected clients, enabling live updates for pipeline changes and inbox messages.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage in PostgreSQL

### Authentication
- **Replit Auth**: OpenID Connect integration for user authentication
- **Passport.js**: Authentication middleware with local strategy support

### Third-Party Libraries
- **Radix UI**: Headless UI primitives for accessible components
- **TanStack Query**: Server state management and caching
- **Drizzle ORM**: Type-safe database queries and schema management
- **Zod**: Runtime schema validation for API inputs
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the entire codebase