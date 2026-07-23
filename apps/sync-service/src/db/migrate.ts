import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { config } from '../config.js'

const client = postgres(config.databaseUrl, { max: 1 })
const db = drizzle(client)

await migrate(db, { migrationsFolder: 'drizzle' })
await client.end()
console.log('Migrations complete')
