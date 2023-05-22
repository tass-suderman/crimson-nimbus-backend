import { Controller, Get, Head, Param, Post, Put, Req, Res } from 'routing-controllers'
import { AppDataSource } from '../data-source'
import { Character } from '../entity/Character'
import { validate, ValidationError } from 'class-validator'
import { Request, Response } from 'express'
import { CustomCharacter } from '../entity/CustomCharacter'
import { DiscordUser } from '../entity/DiscordUser'
import fetch, { Headers } from 'node-fetch'

const DISCORD_URL: string = 'https://discord.com/api/v9/users/@me'
const AUTHORIZATION_HEADER: string = 'Authorization'

// Maybe this should be a map or somehthing. its giving me weird vibes
const ALLOWED_STATS = {
  height: { index: 1, maxValue: 600 },
  weight: { index: 2, maxValue: 1000 },
  intelligence: { index: 3, multiplier: 0.8 },
  strength: { index: 4, multiplier: 1.1 },
  speed: { index: 5, multiplier: 1.0 },
  durability: { index: 6, multiplier: 0.8 },
  combat: { index: 7, multiplier: 1.2 },
  power: { index: 8, multiplier: 1.1 }
}

const MISSING_ID_ERR: string = 'ID must be provided and numeric'
const MISSING_STAT_ERR: string = `Stat index must be provided and be a number between 1 and ${Object.values(ALLOWED_STATS).length}`
const INTERNAL_CHAR_ERR: string = 'Internal character database is unavailable.'
const STAT_OUT_OF_RANGE_ERR = `Stat index must be between 0 and ${Object.values(ALLOWED_STATS).length}`
const UNAUTHORIZED_ERR: string = 'Only the character\'s creator can make changes'
const CHARACTER_JSON_ERR: string = 'URL to the character source must be provided'
const CHAR_ENTITY_ERR: string = 'Problem exists with provided hero file.'
const CHAR_NOT_FOUND: string = 'Character of provided ID not found.'
// TODO If you get this on thw frontend, you are not running the /login route when you should be
const LOGIN_FAILED: string = 'Login failed. Please log out and login again.'

@Controller()
export class CustomCharacterController {
  public static readonly STATUS_CODES: any = {
    OK_STATUS: { code: 200, message: 'Request has succeeded and is fulfilled.' },
    NO_CONTENT: { code: 204, message: 'Request succeeded.' },
    BAD_REQUEST: { code: 400, message: 'Your request cannot be completed as it is malformed.' },
    UNAUTHORIZED_STATUS: { code: 401, message: 'You are not authorized to perform this action.' },
    ITEM_NOT_FOUND: { code: 404, message: 'Requested resource could not be located.' },
    CONFLICT: { code: 409, message: 'Request conflicts with requested resource state.' },
    UNPROCESSABLE_ENTITY: { code: 422, message: 'The provided entity cannot be processes.' },
    INTERNAL_SERVER_ERROR: { code: 500, message: 'The server has an internal error.' }
  }

  public static readonly DESCENDING_OPTIONS: string[] = ['DESC', 'DESCENDING', 'D']

  public static readonly DESCENDING: string = 'DESC'
  public static readonly ASCENDING: string = 'ASC'

  // UUID and Username delimited by :, because those are not allowed in user ids or name
  // source: https://discord.com/developers/docs/resources/user
  public static readonly DELIM: string = ':::'
  public readonly SORT_FIELDS = ['id', 'creator', 'creator.userName']

  private readonly customCharacterRepo = AppDataSource.getRepository(CustomCharacter)
  private readonly userRepo = AppDataSource.getRepository(DiscordUser)
  private readonly characterRepo = AppDataSource.getRepository(Character)

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
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }
    const returnChar: CustomCharacter = await this.customCharacterRepo.findOneBy({ id })

    if (!returnChar) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.ITEM_NOT_FOUND,
        `Character of ID ${id} is not found`)
    }
    return res.json(returnChar)
  }

  @Get('/characternewroll/')
  async getStatCharacters (@Req() req: Request, @Res() res: Response): Promise<any> {
    const characterCount = Object.values(ALLOWED_STATS).length
    const characters = await this.characterRepo.createQueryBuilder('character')
      .addOrderBy('random()')
      .limit(characterCount)
      .getMany()
    if (characters?.length === characterCount) {
      return res.json(characters)
    }
    this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.INTERNAL_SERVER_ERROR, INTERNAL_CHAR_ERR)
  }

  /**
   * Reroll character's stat route
   * stats:
   * 1 = height
   * 2 = weight
   * 3 = intelligence
   * 4 = strength
   * 5 = speed
   * 6 = durability
   * 7 = combat
   * 8 = power
   * @param req
   * @param res
   */
  @Put('/characterreroll/')
  async rerollOneStat (@Req() req: Request, @Res() res: Response): Promise<any> {
    const id: number = parseInt(req.query.charID as string)
    if (!id) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    const stat: number = parseInt(req.query.stat as string)
    if (!stat) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, MISSING_STAT_ERR)
    const statValid: boolean = Object.values(ALLOWED_STATS).map(x => x.index).includes(stat)
    if (!statValid) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, STAT_OUT_OF_RANGE_ERR)
    const statName: string = Object.keys(ALLOWED_STATS)[stat - 1]
    const oldChar: CustomCharacter = await this.customCharacterRepo.findOneBy({ id })
    if (!oldChar) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.ITEM_NOT_FOUND,
      `Character of ID ${id} is not found`)
    }
    if (oldChar.creator.uID !== req.headers.uID) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS, UNAUTHORIZED_ERR)
    }
    const statCharacter: Character = await this.characterRepo.createQueryBuilder()
      .addOrderBy('random()')
      .getOne()
    if (!statCharacter) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.INTERNAL_SERVER_ERROR,
        INTERNAL_CHAR_ERR)
    }
    oldChar[statName] = statCharacter[statName]
    await this.customCharacterRepo.save(oldChar)
    return res.json({ c1: oldChar, c2: statCharacter })
  }

  @Post('/characters/')
  async addCharacter (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    const creator: DiscordUser = await this.userRepo.findOneBy({ uID })
    if (!creator) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.LOGIN_FAILED)
    const { strength, weight, height, intelligence, power, combat, durability, speed, name, url } = req.body
    const wins: number = 0
    const isActive: boolean = true
    const newCharacter = Object.assign(new CustomCharacter(), {
      strength, weight, height, name, intelligence, power, combat, durability, speed, url, wins, creator, isActive
    })
    const violations: ValidationError[] = await validate(newCharacter)
    return violations.length
      ? this.exitWithViolations(res, violations)
      : await this.customCharacterRepo.save(newCharacter)
  }

  @Post('/login')
  async loginDiscordUser (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    let creator: DiscordUser = await this.userRepo.findOneBy({ uID })
    if (!creator) {
      const { userName, displayName, avatar } = req.headers
      const characters: CustomCharacter[] = []
      const hiScore = 0
      creator = Object.assign(new DiscordUser(), { uID, userName, displayName, avatar, characters, hiScore })
      return await this.userRepo.save(creator)
    }
    const { userName, displayName, avatar } = req.headers
    creator.userName = userName as string
    creator.displayName = displayName as string
    creator.avatar = avatar as string
    return await this.userRepo.save(creator)
  }

  @Put('/battle/:charID')
  async battleWithCharacter (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    const id: number = parseInt(req.params.charID) || -1
    if (!uID || id < 0) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST)
    }
    const customChar: CustomCharacter = await this.customCharacterRepo.findOneBy({ id })
    if (!customChar) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.ITEM_NOT_FOUND, CHAR_NOT_FOUND)
    }
    if (customChar.creator.uID !== uID) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS, UNAUTHORIZED_ERR)
    }
    const opponent: Character = this.characterRepo.createQueryBuilder().addOrderBy('random()').getOne()
    if (!opponent) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.INTERNAL_SERVER_ERROR)
    }
    const customCharValuePoints: number = this.calculateValue(customChar)
    const opponentValuePoints: number = this.calculateValue(opponent)
  }

  @Put('/characters/import/:importURL')
  async refreshCharacterDatabase (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    const adminUID = process.env.ADMIN_USER_ID
    console.log(req.params.importURL)

    if (uID !== adminUID) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS)
    }
    if (!req.params.importURL) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, CHARACTER_JSON_ERR)
    try {
      const characterArr = await import(req.params.importURL)
      const badCharacters = []
      const goodCharacters = []
      for (const c of characterArr) {
        const newCharacter = Object.assign(new Character(), c)
        const violations: ValidationError[] = await validate(newCharacter)
        if (violations.length) {
          badCharacters.push({
            character: newCharacter,
            violations
          })
        } else {
          goodCharacters.push(newCharacter)
        }
      }
      if (goodCharacters.length > 0) {
        await this.characterRepo.delete({})
        await this.characterRepo.save(goodCharacters)
        return res.json({
          charactersAdded: goodCharacters.length,
          unprocessableCharacters: badCharacters
        })
      } else {
        console.log(badCharacters[0].violations)
        return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNPROCESSABLE_ENTITY, CHAR_ENTITY_ERR)
      }
    } catch {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST)
    }
  }

  /**
     * This function takes in a request header and uses it to discover more about the user that sent the request.
     * It does this by:
     *  1) Ensuring there is an authorization header in the request
     *  2) Making a request to the Discord API using the very same authorization header.
     * If the request succeeds, the user's ID and username are returned, delimited by :
     * If the request fails, null is returned
     * @param head Request header
     * @return {string | null} Discord ID and username or null
     */
  public static async getUser (@Head() head: any): Promise<string | null> {
    const authToken: string = head.authorization?.toString()
    if (authToken) {
      const fetchHeaders: Headers = new Headers()
      fetchHeaders.append(AUTHORIZATION_HEADER, authToken)
      const response: any = await fetch(DISCORD_URL, { method: 'GET', headers: fetchHeaders })
      const discordUser: any = await response.json()
      if (discordUser.id && discordUser.username) {
        const avatarLink = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.webp`
          // TODO remove this line and instead return empty string when no avatar if default pfp asset is created
          //  on frontend
          : 'https://discord.com/assets/1f0bfc0865d324c2587920a7d80c609b.png'
        const displayName = discordUser.displayName ?? ''
        return `${discordUser.id}${CustomCharacterController.DELIM}${discordUser.username}${CustomCharacterController.DELIM}${displayName}${CustomCharacterController.DELIM}${avatarLink}`
      }
    }
    return null
  }

  /**
     * This method takes in a server response, an error code object, and optionally a message.
     * It will then set the status code of the response to the code of the provided error object.
     * If the errorCode provided is a number, it will be used instead.
     * The response will then be returned as a JSON object with a code and message.
     * If a message is provided when the function is used, it will be returned to the user.
     * Otherwise, the default error message associated with the status code, as declared above, will be returned.
     * @param res Server response
     * @param errorCode Error code object. Also supports numbers if you are bad at reading JSDocs
     * @param message Overridden error message response.
     */
  exitWithMessage (res: Response, errorCode: any, message?: string): any {
    const status: number = isNaN(errorCode) ? errorCode.code : parseInt(errorCode, 10)
    res.statusCode = status
    return res.json({ code: status, message: message ?? errorCode.message })
  }

  /**
     * This method takes in a server response and an array of ValidationErrors
     * It will then set the status code of the response to 422 (Unprocessable entity),
     * and will loop through the validation errors, mapping them to an object which associates
     * each error message with the offending property.
     * After this is complete, the newly created error object is returned in the server response as JSON
     * @param res Server response
     * @param violations Array of validation errors
     */
  exitWithViolations (res: Response, violations: ValidationError[]): any {
    res.statusCode = CustomCharacterController.STATUS_CODES.UNPROCESSABLE_ENTITY.code
    const errors: any[] = []
    for (const error of violations) {
      errors.push({ [error.property]: Object.values(error.constraints)[0] })
    }
    return res.json(errors)
  }

  /**
     * This function takes in a request object and generates Sort field and Sort order from the request's query.
     * If the request specifies neither of these, defaults are used (Often the ID Number in ascending order)
     * Otherwise, the request parameters are checked against allowed fields and sort orders, and are generated as
     * requested. They are then returned as an anonymous sorting object.
     * @param req Client Request
     */
  getSortOptions (@Req() req: Request): any {
    const sortOptions: any = {
      order: {},
      field: ''
    }
    sortOptions.field = this.SORT_FIELDS.includes(req.query.sortby as string) ? req.query.sortby : this.SORT_FIELDS[0]
    sortOptions.order = CustomCharacterController.DESCENDING_OPTIONS.includes((req.query.sortorder as string)?.toUpperCase())
      ? CustomCharacterController.DESCENDING
      : CustomCharacterController.ASCENDING
    return sortOptions
  }

  calculateValuePoints (character: CustomCharacter | Character): number {
    let returnVP: number = 0
    //TODO find a cute way to automate this process later
    returnVP += Math.min(character.height, ALLOWED_STATS.height.maxValue)
    returnVP += Math.min(character.weight, ALLOWED_STATS.weight.maxValue)
    returnVP += character.combat * ALLOWED_STATS.combat.multiplier
    returnVP += character.strength * ALLOWED_STATS.strength.multiplier
    returnVP += character.speed * ALLOWED_STATS.speed.multiplier
    returnVP += character.intelligence * ALLOWED_STATS.intelligence.multiplier
    returnVP += character.power * ALLOWED_STATS.power.multiplier
    returnVP += character.durability * ALLOWED_STATS.durability.multiplier
    return returnVP
  }
}
