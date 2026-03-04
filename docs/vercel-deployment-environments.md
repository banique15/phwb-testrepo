# Vercel Deployment Environments

Guide for setting up production, staging, and feature branch preview deployments with custom subdomains.

## Current Setup

| Environment | Domain | Branch |
|---|---|---|
| Production | `phwb.singforhope.org` | `main` |

## Target Setup

| Environment | Domain | Branch |
|---|---|---|
| Production | `phwb.singforhope.org` | `main` |
| Staging | `staging.phwb.singforhope.org` | `staging` or `develop` |
| Feature previews | `<branch-name>.phwb.singforhope.org` | Auto per branch (wildcard) |

## DNS Records Required

Add these CNAME records in the DNS provider for `singforhope.org`:

```
phwb.singforhope.org          CNAME  cname.vercel-dns.com   (already exists)
staging.phwb.singforhope.org  CNAME  cname.vercel-dns.com
*.phwb.singforhope.org        CNAME  cname.vercel-dns.com
```

> The wildcard (`*`) record covers all feature branch subdomains automatically.

## Vercel Configuration Steps

### 1. Staging Domain

1. Go to **Vercel project** > **Settings** > **Domains**
2. Add `staging.phwb.singforhope.org`
3. Click the domain and set **Git Branch** to the staging branch (e.g. `staging`)
4. Add the DNS CNAME record listed above

### 2. Feature Branch Previews (Wildcard)

1. In **Vercel project** > **Settings** > **Domains**, add `*.phwb.singforhope.org`
2. Add the wildcard DNS CNAME record listed above
3. Each branch push will be accessible at `<branch-name>.phwb.singforhope.org`

> **Note:** Wildcard domains require the Vercel **Pro plan**. On the free/Hobby plan, each branch domain must be added manually in Settings > Domains.

### 3. Manual Per-Branch Domain (Free Plan Alternative)

If wildcard isn't available:

1. Go to **Settings** > **Domains**
2. Add e.g. `in-app-notification.phwb.singforhope.org`
3. Assign it to the `in-app-notification` branch
4. Add a CNAME record for that specific subdomain

Repeat for each feature branch that needs a preview URL.

## Environment Variables per Deployment

To keep staging/preview data separate from production:

1. Go to **Vercel project** > **Settings** > **Environment Variables**
2. Set different values for each environment scope:
   - **Production**: points to the production Supabase project
   - **Preview**: points to a staging/test Supabase project
   - **Development**: points to local or dev Supabase

Key variables to scope:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

## Git Branch Strategy

Recommended branch flow:

```
feature/fix branches
       |
       v
    staging  →  staging.phwb.singforhope.org (preview/QA)
       |
       v
     main    →  phwb.singforhope.org (production)
```

1. Create feature branches off `main` (e.g. `in-app-notification`)
2. Open PRs into `staging` for QA and review
3. Merge `staging` into `main` when ready to deploy to production
