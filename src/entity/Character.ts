import { Column, PrimaryGeneratedColumn, Entity, ManyToOne, PrimaryColumn } from 'typeorm'
import { IsInt, IsNotEmpty, IsOptional, Length, Max, Min } from 'class-validator'

const ID_MIN: number = 0
const ID_BOUNDARY_ERROR : string = 'ID must be greater than $constraint1'

const HEIGHT_MIN: number = 0
const HEIGHT_BOUNDARY_ERROR : string = 'Height must be greater than $constraint1'

const WEIGHT_MIN: number = 0
const WEIGHT_BOUNDARY_ERROR : string = 'Weight must be greater than $constraint1'

const NAME_MIN : number = 1
const NAME_MAX : number = 64
const NAME_LENGTH_ERR : string = 'Character name must be from $constraint1 to $constraint2 characters.'

const INT_MIN = 0;
const INT_MAX = 100;
const INT_ERR = "Intelligence must be between $constraint1 and $constraint2."

const STR_MIN = 0;
const STR_MAX = 100;
const STR_ERR = "Strength must be between $constraint1 and $constraint2."

const SPD_MIN = 0;
const SPD_MAX = 100;
const SPD_ERR = "Speed must be between $constraint1 and $constraint2."

const DUR_MIN = 0;
const DUR_MAX = 100;
const DUR_ERR = "Durability must be between $constraint1 and $constraint2."

const POW_MIN = 0;
const POW_MAX = 100;
const POW_ERR = "Power must be between $constraint1 and $constraint2."

const COM_MIN = 0;
const COM_MAX = 100;
const COM_ERR = "Combat must be between $constraint1 and $constraint2."

const IMAGE_PREFIX_MIN = 1
const IMAGE_PREFIX_ERR = "Image prefix must not be shorter than $constraint1 characters."

const IMAGE_SUFFIX_MIN = 1
const IMAGE_SUFFIX_ERR = "Image suffix must not be shorter than $constraint1 characters."

@Entity()
export class Character {
  @PrimaryColumn({type:'number'})
  @Min(ID_MIN,{message:ID_BOUNDARY_ERROR})
    id: number

  @Column

  @Column({ type: 'varchar', length: NAME_MAX })
  @Min(NAME_MIN)
  @Length(NAME_MIN, NAME_MAX,
    { message: COMMAND_NAME_LENGTH_ERR })
  @IsNotEmpty()
    cName: string

  @Column({ type: 'varchar', length: NAME_MAX })
  @Length(TEXT_MIN, TEXT_MAX,
    { message: COMMAND_TEXT_LENGTH_ERR })
  @IsOptional()
    cText: string

  @Column({ type: 'boolean', default: false })
  @IsOptional()
    cMentionsUser: boolean

  @Column({ type: 'integer', default: MENTION_MIN })
  @IsInt()
  @Min(MENTION_MIN, { message: COMMAND_MENTION_MIN_ERR })
  @Max(MENTION_MAX, { message: COMMAND_MENTION_MAX_ERR })
    cNumMentions: number

  @ManyToOne(() => RegisteredUser, {
    cascade: ['insert', 'update'],
    eager: true
  })
    cCreator: RegisteredUser

  @ManyToOne(() => Meme, { eager: true })
  @IsNotEmpty()
    meme: Meme
}
