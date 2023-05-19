/**
 * @author Tass Suderman, Levi Krozser
 * @purpose Meme entity for CWEB280FinalProject
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, ManyToOne } from 'typeorm'
import { IsOptional, Length, Matches } from 'class-validator'
import { Tag } from './Tag'
import { RegisteredUser } from './DiscordUser'

const DESC_MIN: number = 1
const DESC_MAX: number = 64
const DESC_LENGTH_ERROR: string = 'Meme description must be from $constraint1 to $constraint2 characters'

// https://stackoverflow.com/questions/4098415/use-regex-to-get-image-url-in-html-js
const IMAGE_LENGTH_MIN: number = 8
const IMAGE_LENGTH_MAX: number = 512
const IMAGE_LENGTH_ERR: string = 'Image route path must be from $constraint1 to $constraint2 characters'
const IMAGE_REGEX: RegExp = /(http)?s?:?(\/\/[^"']*\.(?:jpg|jpeg|gif|png|svg))/
const IMAGE_URL_ERR: string = 'Meme image must be a valid image URL'

@Entity()
export class Meme {
  @PrimaryGeneratedColumn()
  @IsOptional()
    memeID: number

  @Column({ type: 'varchar', length: DESC_MAX })
  @Length(DESC_MIN, DESC_MAX,
    { message: DESC_LENGTH_ERROR })
    mDescription: string

  @Column({ type: 'varchar', length: IMAGE_LENGTH_MAX })
  @Length(IMAGE_LENGTH_MIN, IMAGE_LENGTH_MAX,
    { message: IMAGE_LENGTH_ERR })
  @Matches(IMAGE_REGEX, {
    message: IMAGE_URL_ERR
  })
    mImageRoute: string

  @ManyToMany(() => Tag, tag => tag.memes, {
    cascade: ['insert'],
    eager: true
  })
  @JoinTable()
    tags: Tag[]

  @ManyToOne(() => RegisteredUser, user => user.memes, {
    cascade: ['insert', 'update'],
    eager: true
  })
    mCreator: RegisteredUser
}
