# Required GitHub Secrets

These secrets must be configured in **Settings → Secrets and variables → Actions** for workflows to function.

## Required Secrets

| Secret | Used by | Description |
|--------|---------|-------------|
| `DATABASE_URL` | scrape-peak, scrape-low, staleness-alert, supabase-keepalive | Supabase PostgreSQL connection string (pooler, port 6543). Format: `postgresql://postgres.[ref]:[password]@[host]:6543/postgres` |
| `SUPABASE_SERVICE_ROLE_KEY` | scrape-peak, scrape-low | Supabase service role key for admin DB access during scraping |
| `NEXT_PUBLIC_SUPABASE_URL` | ci | Supabase project URL (optional — falls back to placeholder for CI builds) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ci | Supabase anonymous key (optional — falls back to placeholder for CI builds) |

## Optional Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `PEAK_SCHEDULE_ENABLED` | scrape-peak | Set to `true` during July peak season to enable 4x/day scraping |

## Setup Instructions

1. Go to your Supabase project → Settings → Database → Connection string
2. Copy the connection string (use **Session mode** on port 6543)
3. In GitHub: Settings → Secrets → New repository secret
4. Add `DATABASE_URL` with the connection string
5. Add `SUPABASE_SERVICE_ROLE_KEY` from Supabase Settings → API → service_role key
