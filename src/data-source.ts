import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Character } from './entity/Character'
import { DiscordUser } from './entity/DiscordUser'
import { CustomCharacter } from './entity/CustomCharacter'

const entities = [Character, DiscordUser, CustomCharacter]
const DEFAULT_NAME = 'crimson-nimbus.db'

const DEV_DB = {
  type: 'better-sqlite3',
  database: DEFAULT_NAME,
  entities,
  synchronize: true,
  logging: false,
  migrations: [],
  subscribers: []
}
let dbOptions: any = {}

if (process.env?.NODE_ENV?.toUpperCase() === 'PRODUCTION') {
  dbOptions = {
    type: process.env.DB_TYPE ?? 'mysql',
    database: process.env.DB_NAME ?? DEFAULT_NAME,
    entities,
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: process.env.DB_PORT ?? 3306,
    username: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    synchronize: true
    // TODO export schema after it is created and then import it as entitySchemas argument
    //  See more https://orkhan.gitbook.io/typeorm/docs/data-source-options
  }
} else {
  dbOptions = DEV_DB
}
export const AppDataSource = new DataSource(dbOptions)
