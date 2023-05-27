import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Character } from './entity/Character'
import { DiscordUser } from './entity/DiscordUser'
import { CustomCharacter } from './entity/CustomCharacter'

import { config } from 'dotenv'

config()

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

export const AppDataSource = new DataSource(DEV_DB as any)
export const RANDOM_FUNCTION: string = 'random()'
