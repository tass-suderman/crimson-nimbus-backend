import { IsOptional, Length, MaxLength, Min } from 'class-validator'
import { Column, OneToMany, PrimaryColumn } from 'typeorm'
import { CustomCharacter } from './CustomCharacter'

const USER_ID_MIN: number = 17
const USER_ID_MAX: number = 20
const USER_ID_LENGTH_ERR: string = 'User ID must be from $constraint1 to $constraint2 characters'
const DISPLAY_NAME_MAX: number = 32
const DISPLAY_NAME_LENGTH_ERR: string = 'Display name cannot exceed $constraint1 characters'
const USER_NAME_MIN: number = 2
const USER_NAME_MAX: number = 32
const USER_NAME_LENGTH_ERR: string = 'Username must be from $constraint1 to $constraint2 characters'
const AVATAR_MAX: number = 64
const AVATAR_LENGTH_ERR: string = 'Avatar cannot exceed $constraint1 characters'
const HIGH_SCORE_MIN: number = 0
const HIGH_SCORE_MIN_ERR = 'High score cannot be smaller than 0'

export class DiscordUser {
  @PrimaryColumn()
  @Length(USER_ID_MIN, USER_ID_MAX,
    { message: USER_ID_LENGTH_ERR })
  @IsOptional()
    uID: string

  @Column({ type: 'string', length: 32 })
  @Length(USER_NAME_MIN, USER_NAME_MAX,
    { message: USER_NAME_LENGTH_ERR })
  @IsOptional()
    userName: string

  @Column({ type: 'string', length: 32 })
  @MaxLength(DISPLAY_NAME_MAX,
    { message: DISPLAY_NAME_LENGTH_ERR })
  @IsOptional()
    displayName: string

  @Column({ type: 'string' })
  @MaxLength(AVATAR_MAX,
    { message: AVATAR_LENGTH_ERR })
  @IsOptional()
    avatar: string

  @Column({ type: 'number' })
  @Min(HIGH_SCORE_MIN, { message: HIGH_SCORE_MIN_ERR })
  @IsOptional()
    hiScore: number

  @OneToMany(type => CustomCharacter, character => character.creator)
    characters: CustomCharacter[]
}
