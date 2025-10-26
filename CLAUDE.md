# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and all other AI agents when working with code in this repository.

## Project Overview

**PHWB Admin** is a comprehensive management system for Sing for Hope. The application manages artists, events, venues, partners, programs, payroll, and reporting functionality with full authentication and real-time data synchronization.

## Development Commands

- `bun dev` - Start development server
- `bun dev --open` - Start development server and open browser
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run check` - Run Svelte type checking
- `bun run check:watch` - Run Svelte type checking in watch mode

## Project Architecture

### Framework Stack
- **SvelteKit** - Full-stack framework using Svelte 5 with runes
- **Supabase** - Backend-as-a-Service with authentication and real-time database
- **TypeScript** - Type checking enabled with strict mode
- **Tailwind CSS** - Utility-first CSS framework with v4.x
- **DaisyUI** - Tailwind CSS component library
- **Vite** - Build tool and development server
- **Bun** - Package manager and runtime

### Authentication & Security
- **Supabase Auth** - Email-based authentication with session management
- **Protected Routes** - All routes except `/login` require authentication
- **Server-side Auth** - Handled via `src/hooks.server.ts` with cookie-based sessions
- **Client-side Auth** - Reactive authentication store in `src/lib/auth.ts`

### Directory Structure

#### Core Application
- `src/routes/+layout.svelte` - Main layout with authentication-aware navigation
- `src/routes/+page.svelte` - Dashboard with stats and quick actions
- `src/routes/login/` - Authentication pages
- `src/app.html` - HTML template
- `src/app.css` - Global styles with Tailwind imports
- `src/app.d.ts` - Global TypeScript definitions with Supabase types
- `static/` - Static assets

#### Business Module Routes
- `src/routes/artists/` - Artist management with master-detail views
- `src/routes/events/` - Event scheduling and management
- `src/routes/venues/` - Venue information and management
- `src/routes/partners/` - Partnership and sponsor management
- `src/routes/programs/` - Program offerings and structure
- `src/routes/payroll/` - Payment and compensation tracking
- `src/routes/reports/` - Analytics and reporting functionality

#### Library Components
- `src/lib/components/` - Reusable UI components (Sidebar, etc.)
- `src/lib/stores/` - Reactive stores for each business entity
- `src/lib/supabase.ts` - Supabase client configuration
- `src/lib/auth.ts` - Authentication state management
- `src/hooks.server.ts` - Server-side authentication and route protection

### Data Architecture

#### Database Schema (Supabase)
All tables use the `phwb_` prefix:
- `phwb_artists` - Artist profiles with skills, availability, and professional info
- `phwb_events` - Event management and scheduling
- `phwb_venues` - Venue information
- `phwb_partners` - Partnership and sponsor data
- `phwb_programs` - Program structure and offerings
- `phwb_config_options` - System configuration (entity/field/value structure)
- Additional tables for payroll, reports, and user profiles

#### Store System
Each business entity has a dedicated store (`src/lib/stores/`):
- `artists.ts` - Artist management with full CRUD operations
- `events.ts` - Event scheduling and management
- `venues.ts` - Venue data management
- `partners.ts` - Partnership management
- `programs.ts` - Program management
- `payroll.ts` - Payment tracking
- `reports.ts` - Analytics and reporting
- `profiles.ts` - User profile management
- `config.ts` - System configuration

### UI/UX Architecture

#### Layout System
- **Responsive drawer-based navigation** with collapsible sidebar
- **Authentication-aware layout** with conditional rendering
- **Master-detail views** for complex data (e.g., Artists page)
- **DaisyUI components** for consistent styling throughout

#### Navigation Structure
- 🏠 Dashboard - Overview with stats and quick actions
- 🎨 Artists - Comprehensive artist profiles and management
- 🤝 Partners - Partnership and sponsor management
- 📋 Programs - Program offerings and structure
- 🏛️ Venues - Venue information and management
- 🎪 Events - Event scheduling and management
- 📊 Reports - Analytics and reporting
- 💰 Payroll - Payment and compensation tracking

### Environment Configuration

Required environment variables:
- `PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Key Configuration
- Uses `@sveltejs/adapter-auto` for deployment
- Tailwind CSS v4 configured with Forms, Typography, and DaisyUI plugins
- TypeScript with bundler module resolution
- Vite plugins: TailwindCSS, SvelteKit, and devtools-json
- Supabase SSR configuration for server-side rendering

### Svelte 5 Features
- Uses new runes syntax (`$state()`, `$derived()`, `$props()`)
- Modern component patterns with `{@render children()}`
- Reactive stores with Supabase integration
- TypeScript integration throughout

## Development Notes

When working with this codebase:

### General Guidelines
- Follow SvelteKit file-based routing conventions
- Use Svelte 5 runes syntax for reactivity
- Leverage DaisyUI components for UI elements
- TypeScript is strictly enforced - run `bun run check` before committing
- Global styles are defined in `src/app.css` using Tailwind directives

### Authentication
- All routes except `/login` are protected by authentication
- User session is managed server-side via cookies
- Client-side authentication state is reactive via stores
- Authentication redirects are handled automatically

### Data Management
- Use the corresponding store for each business entity
- Stores provide full CRUD operations with Supabase integration
- Real-time updates are handled automatically by Supabase
- Local state persistence where appropriate (e.g., selected artist)

### UI Development
- Use DaisyUI components for consistent styling
- Follow the established master-detail pattern for complex views
- Implement loading states and error handling for async operations
- Maintain responsive design principles with drawer-based navigation

### Database Operations
- All database operations go through the store system
- Use TypeScript interfaces for type safety
- Follow the `phwb_` table naming convention
- Implement proper error handling for database operations