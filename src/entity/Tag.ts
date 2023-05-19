/**
 * @author Tass Suderman, Levi Krozser
 * @purpose Tag entity for CWEB280FinalProject
 */
import { Entity, Unique, PrimaryColumn, ManyToMany } from 'typeorm'
import { IsAlphanumeric, IsOptional, Length } from 'class-validator'
import { Meme } from './Meme'

const TAG_NAME_MIN: number = 1
const TAG_NAME_MAX: number = 12
const TAG_NAME_ERR: string = 'Tag name must be from $constraint1 to $constraint2 characters'

@Entity()
@Unique(['tagName'])
export class Tag {
  @PrimaryColumn({ type: 'varchar', length: TAG_NAME_MAX })
  @IsAlphanumeric()
  @Length(TAG_NAME_MIN, TAG_NAME_MAX,
    { message: TAG_NAME_ERR })
    tagName: string

  @ManyToMany(() => Meme, meme => meme.tags)
    memes: Meme[]
}
