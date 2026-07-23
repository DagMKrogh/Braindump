import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { config } from '../config.js'

import * as schema from '../db/schema.js'

const client = postgres(config.databaseUrl)
export const db = drizzle(client, { schema })
