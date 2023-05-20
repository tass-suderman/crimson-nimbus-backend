import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Character } from './entity/Character'
import { DiscordUser } from './entity/DiscordUser'
import { CustomCharacter } from './entity/CustomCharacter'

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: 'crimson-nimbus.db',
  synchronize: true,
  logging: false,
  entities: [Character, DiscordUser, CustomCharacter],
  migrations: [],
  subscribers: []
})

// TODO: Come back and fix this later
//  Change datasource from local sqlite to gcloud mysql
//  Refer to https://orkhan.gitbook.io/typeorm/docs/data-source
