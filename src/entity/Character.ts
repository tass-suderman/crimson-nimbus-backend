import { Column, Entity, PrimaryColumn } from 'typeorm'
import { IsNotEmpty, Length, Max, Min, MinLength } from 'class-validator'

const ID_MIN: number = 0
const ID_BOUNDARY_ERROR: string = 'ID must be greater than $constraint1'

const NAME_MIN: number = 1
const NAME_MAX: number = 64
const NAME_LENGTH_ERR: string = 'Character name must be from $constraint1 to $constraint2 characters.'

const HEIGHT_MIN: number = 0
const HEIGHT_BOUNDARY_ERROR: string = 'Height must be greater than $constraint1'

const WEIGHT_MIN: number = 0
const WEIGHT_BOUNDARY_ERROR: string = 'Weight must be greater than $constraint1'

const INT_MIN = 0
const INT_MAX = 100
const INT_ERR = 'Intelligence must be between $constraint1 and $constraint2.'

const STR_MIN = 0
const STR_MAX = 100
const STR_ERR = 'Strength must be between $constraint1 and $constraint2.'

const SPD_MIN = 0
const SPD_MAX = 100
const SPD_ERR = 'Speed must be between $constraint1 and $constraint2.'

const DUR_MIN = 0
const DUR_MAX = 100
const DUR_ERR = 'Durability must be between $constraint1 and $constraint2.'

const POW_MIN = 0
const POW_MAX = 100
const POW_ERR = 'Power must be between $constraint1 and $constraint2.'

const COM_MIN = 0
const COM_MAX = 100
const COM_ERR = 'Combat must be between $constraint1 and $constraint2.'

const IMAGE_PREFIX_MIN = 1
const IMAGE_PREFIX_ERR = 'Image prefix must not be shorter than $constraint1 characters.'

const IMAGE_SUFFIX_MIN = 1
const IMAGE_SUFFIX_ERR = 'Image suffix must not be shorter than $constraint1 characters.'

@Entity()
export class Character {
  @PrimaryColumn()
  @Min(ID_MIN, { message: ID_BOUNDARY_ERROR })
    id: number

  @Column({ type: 'varchar', length: NAME_MAX })
  @Length(NAME_MIN, NAME_MAX,
    { message: NAME_LENGTH_ERR })
  @IsNotEmpty()
    name: string

  @Column({ type: 'integer' })
  @Min(WEIGHT_MIN, { message: WEIGHT_BOUNDARY_ERROR })
  @IsNotEmpty()
    weight: number

  @Column({ type: 'integer' })
  @Min(HEIGHT_MIN, { message: HEIGHT_BOUNDARY_ERROR })
  @IsNotEmpty()
    height: number

  @Column({ type: 'integer' })
  @Min(INT_MIN, { message: INT_ERR })
  @Max(INT_MAX, { message: INT_ERR })
  @IsNotEmpty()
    intelligence: number

  @Column({ type: 'integer' })
  @Min(STR_MIN, { message: STR_ERR })
  @Max(STR_MAX, { message: STR_ERR })
  @IsNotEmpty()
    strength: number

  @Column({ type: 'integer' })
  @Min(DUR_MIN, { message: DUR_ERR })
  @Max(DUR_MAX, { message: DUR_ERR })
  @IsNotEmpty()
    durability: number

  @Column({ type: 'integer' })
  @Min(COM_MIN, { message: COM_ERR })
  @Max(COM_MAX, { message: COM_ERR })
  @IsNotEmpty()
    combat: number

  @Column({ type: 'integer' })
  @Min(POW_MIN, { message: POW_ERR })
  @Max(POW_MAX, { message: POW_ERR })
  @IsNotEmpty()
    power: number

  @Column({ type: 'integer' })
  @Min(SPD_MIN, { message: SPD_ERR })
  @Max(SPD_MAX, { message: SPD_ERR })
  @IsNotEmpty()
    speed: number

  @Column({ type: 'varchar' })
  @MinLength(IMAGE_SUFFIX_MIN, { message: IMAGE_SUFFIX_ERR })
  @IsNotEmpty()
    imageSuffix: string

  @Column({ type: 'varchar' })
  @MinLength(IMAGE_PREFIX_MIN, { message: IMAGE_PREFIX_ERR })
  @IsNotEmpty()
    imagePrefix: string
}
