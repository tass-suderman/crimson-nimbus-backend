/**
 * @author Tass Suderman, Levi Krozser
 */
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Meme } from './entity/Meme'
import { Character } from './entity/Character'
import { DiscordUser, RegisteredUser } from './entity/DiscordUser'
import { Tag } from './entity/Tag'

export const AppDataSource = new DataSource({
  type: 'mysql',
  database: 'crimson-nimbus.db',
  synchronize: true,
  logging: false,
  entities: [Character, DiscordUser, CustomCharacter],
  migrations: [],
  subscribers: []
})

// TODO: Come back and fix this later
//  Refer to https://orkhan.gitbook.io/typeorm/docs/data-source
