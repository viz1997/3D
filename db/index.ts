import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const client = postgres(connectionString, {
  // Connection pool size
  // max: 1, // Set to 1 for serverless (Vercel, Netlify, AWS Lambda)
  // max: 10, // Default for traditional servers

  // Prepared statements
  prepare: false, // Set to false for Supabase/Neon (required)
  // Set to true or omit for self-hosted PostgreSQL (better performance)
})

export const db = drizzle(client)