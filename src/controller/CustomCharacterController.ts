import { Controller, Delete, Get, Param, Post, Put, Req, Res } from 'routing-controllers'
import { AppDataSource } from '../data-source'
import { Character } from '../entity/Character'
import { validate, ValidationError } from 'class-validator'
import { NextFunction, Request, response, Response } from 'express'
import { AController } from './AController'
import { CustomCharacter } from '../entity/CustomCharacter'
import { DiscordUser } from '../entity/DiscordUser'
import fetch from 'node-fetch'

// Maybe this should be a map or somehthing. its giving me weird vibes
const ALLOWED_STATS = {
  height: 1,
  weight: 2,
  intelligence: 3,
  strength: 4,
  speed: 5,
  durability: 6,
  combat: 7,
  power: 8
}

const MISSING_ID_ERR: string = 'ID must be provided and numeric'
const MISSING_STAT_ERR: string = `Stat index must be provided and be a number between 1 and ${Object.values(ALLOWED_STATS).length}`
const INTERNAL_CHAR_ERR: string = 'Internal character database is unavailable.'
const STAT_OUT_OF_RANGE_ERR = `Stat index must be between 0 and ${Object.values(ALLOWED_STATS).length}`
const UNAUTHORIZED_ERR: string = 'Only the character\'s creator can make changes'
const CHARACTER_JSON_ERR: string = 'URL to the character source must be provided'
const CHAR_ENTITY_ERR: string = 'Problem exists with provided hero file.'

@Controller()
export class CustomCharacterController extends AController {
  public override readonly SORT_FIELDS = ['id', 'creator', 'creator.userName']

  private readonly customCharacterRepo = AppDataSource.getRepository(CustomCharacter)
  private readonly userRepo = AppDataSource.getRepository(DiscordUser)
  private readonly characterRepo = AppDataSource.getRepository(Character)

  // TODO look into having this display other players' characters at some point
  @Get('/characters/')
  async getCharacters (@Req() req: Request): Promise<any> {
    const where: string = req.query.where as string ?? '%'
    const queryWhere: string = `%${where}`
    const sortOptions: any = this.getSortOptions(req)
    return await this.customCharacterRepo
      .createQueryBuilder('customChar')
      .leftJoinAndSelect('customChar.creator', 'creator')
      .where('creator.userName LIKE :queryWhere', { queryWhere })
      .orWhere('creator.uID LIKE :queryWhere', { queryWhere })
      .addOrderBy(sortOptions.field, sortOptions.order)
      .getMany()
  }

  @Get('/characters/:id')
  async getOneCharacter (@Param('id') id: number, @Res() res: Response): Promise<any> {
    if (!id) {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }
    const returnChar: CustomCharacter = await this.customCharacterRepo.findOneBy({ id })

    if (!returnChar) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND,
        `Character of ID ${id} is not found`)
    }
    return res.json(returnChar)
  }

  @Get('/characters/newroll/')
  async getStatCharacters (@Req() req: Request, @Res() res: Response): Promise<any> {
    const characterCount = Object.values(ALLOWED_STATS).length
    const characters = await this.characterRepo.createQueryBuilder('character')
      .addOrderBy('random')
      .limit(characterCount)
      .getMany()
    if (characters?.length === characterCount) {
      return res.json(characters)
    }
    this.exitWithMessage(res, AController.STATUS_CODES.INTERNAL_SERVER_ERROR, INTERNAL_CHAR_ERR)
  }

  /**
   * Reroll character's stat route
   * stats:
   * 0 = height
   * 1 = weight
   * 2 = intelligence
   * 3 = strength
   * 4 = speed
   * 5 = durability
   * 6 = combat
   * 7 = power
   * @param req
   * @param res
   */
  @Put('/characters/reroll/')
  async rerollOneStat (@Req() req: Request, @Res() res: Response): Promise<any> {
    const id: number = parseInt(req.query.charID as string)
    if (!id) return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    const stat: number = parseInt(req.query.stat as string)
    if (!stat) return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_STAT_ERR)
    const statValid: boolean = Object.values(ALLOWED_STATS).includes(stat)
    if (!statValid) return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, STAT_OUT_OF_RANGE_ERR)
    const statName: string = Object.keys(ALLOWED_STATS)[stat - 1]
    const oldChar: CustomCharacter = await this.customCharacterRepo.findOneBy({ id })
    if (!oldChar) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND,
      `Character of ID ${id} is not found`)
    }
    if (oldChar.creator.uID !== req.headers.uID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.UNAUTHORIZED_STATUS, UNAUTHORIZED_ERR)
    }
    const statCharacter: Character = await this.characterRepo.createQueryBuilder()
      .addOrderBy('random')
      .getOne()
    if (!statCharacter) {
      return this.exitWithMessage(res, AController.STATUS_CODES.INTERNAL_SERVER_ERROR,
        INTERNAL_CHAR_ERR)
    }
    oldChar[statName] = statCharacter[statName]
    await this.customCharacterRepo.save(oldChar)
    return res.json({ c1: oldChar, c2: statCharacter })
  }

  @Post('/characters/')
  async addCharacter (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    let creator: DiscordUser = await this.userRepo.findOneBy({ uID })
    if (!creator) {
      const { userName, displayName, avatar } = req.headers
      const characters: CustomCharacter[] = []
      const hiScore = 0
      creator = Object.assign(new DiscordUser(), { uID, userName, displayName, avatar, characters, hiScore })
      await this.userRepo.save(creator)
    }
    const { strength, weight, height, intelligence, power, combat, durability, speed, name, url } = req.body
    const wins = 0
    const newCharacter = Object.assign(new CustomCharacter(), {
      strength, weight, height, name, intelligence, power, combat, durability, speed, url, wins, creator
    })
    const violations: ValidationError[] = await validate(newCharacter)
    return violations.length
      ? this.exitWithViolations(res, violations)
      : await this.customCharacterRepo.save(newCharacter)
  }

  @Put('/characters/import/:importURL')
  async refreshCharacterDatabase (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    const adminUID = process.env.ADMIN_USER_ID
    console.log(req.params.importURL)

    if (uID !== adminUID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.UNAUTHORIZED_STATUS)
    }
    if (!req.params.importURL) return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, CHARACTER_JSON_ERR)
    try {
      const characterArr = await import(req.params.importURL)
      const badCharacters = []
      const goodCharacters = []
      for (const c of characterArr) {
        const newCharacter = Object.assign(new Character(), c)
        const violations: ValidationError[] = await validate(newCharacter)
        if (violations.length) {
          badCharacters.push({ character: newCharacter, violations })
        } else {
          goodCharacters.push(newCharacter)
        }
      }
      if (goodCharacters.length > 0) {
        await this.characterRepo.delete({})
        await this.characterRepo.save(goodCharacters)
        return res.json({ charactersAdded: goodCharacters.length, unprocessableCharacters: badCharacters })
      } else {
        console.log(badCharacters[0].violations)
        return this.exitWithMessage(res, AController.STATUS_CODES.UNPROCESSABLE_ENTITY, CHAR_ENTITY_ERR)
      }
    } catch {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST)
    }
  }
}
