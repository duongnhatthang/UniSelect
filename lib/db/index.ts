import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use POOLER URL (port 6543) not direct DB URL (port 5432)
// Set prepare: false for transaction pool mode (Supabase Supavisor)
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle({ client, schema });
