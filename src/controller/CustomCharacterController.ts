import { Controller, Get, Head, Param, Post, Put, Req, Res } from 'routing-controllers'
import { AppDataSource, RANDOM_FUNCTION } from '../data-source'
import { Character } from '../entity/Character'
import { validate, ValidationError } from 'class-validator'
import { Request, Response } from 'express'
import { CustomCharacter } from '../entity/CustomCharacter'
import { DiscordUser } from '../entity/DiscordUser'
import fetch, { Headers } from 'node-fetch'
import { config } from 'dotenv'
import { Repository } from 'typeorm'
config()
const DISCORD_URL: string = 'https://discord.com/api/v9/users/@me'
const AUTHORIZATION_HEADER: string = 'Authorization'

const ALLOWED_STATS: any = {
  height: { index: 1, multiplier: 0.2, maxValue: 600 },
  weight: { index: 2, multiplier: 0.3, maxValue: 1000 },
  intelligence: { index: 3, multiplier: 0.8 },
  strength: { index: 4, multiplier: 1.1 },
  speed: { index: 5, multiplier: 1.0 },
  durability: { index: 6, multiplier: 0.8 },
  combat: { index: 7, multiplier: 1.2 },
  power: { index: 8, multiplier: 1.1 }
}

const ALLOWED_SIZE: string[] = ['sm', 'md', 'lg', 'xl']

const MISSING_ID_ERR: string = 'ID must be provided and numeric'
const MISSING_STAT_ERR: string =
  `Stat index must be provided and be a number between 1 and ${Object.values(ALLOWED_STATS).length}`
const INTERNAL_CHAR_ERR: string = 'Internal character database is unavailable.'
const STAT_OUT_OF_RANGE_ERR = `Stat index must be between 0 and ${Object.values(ALLOWED_STATS).length}`
const UNAUTHORIZED_ERR: string = 'Only the character\'s creator can make changes'
const CHARACTER_JSON_ERR: string = 'URL to the character source must be provided'
const CHAR_ENTITY_ERR: string = 'Problem exists with provided hero file.'
const CHAR_NOT_FOUND: string = 'Character of provided ID not found.'
const LOGIN_FAILED: string = 'Login failed. Please log out and login again.'
const CHAR_INACTIVE: string = 'This character is not on duty.'
const DEFAULT_PFP: string = 'https://discord.com/assets/1f0bfc0865d324c2587920a7d80c609b.png'

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

  public static readonly DELIM: string = ':::'
  public readonly SORT_FIELDS: string[] = ['id', 'creator', 'creator.userName']

  private readonly customCharacterRepo: Repository<CustomCharacter> = AppDataSource.getRepository(CustomCharacter)
  private readonly userRepo: Repository<DiscordUser> = AppDataSource.getRepository(DiscordUser)
  private readonly characterRepo: Repository<Character> = AppDataSource.getRepository(Character)

  /**
   * Login route.
   * To be executed once when the player first logs in
   * If changes are made to the player's Discord profile, running this route can refresh their Discord Data
   * This route returns Discord Data, as well as player data, such as their high score
   * @param req
   * @param res
   */
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

  /**
   * Get route for characters
   * Returns a collection of all custom characters
   * "where" can be passed in as a query parameter to filter by player or id
   * @param req
   */
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

  /**
   * Get route for all non-playable characters
   * Returns a collection of all non-playable characters
   * "size" can be provided as query -- defaults to md
   * size can be sm, md, lg, xl
   * @param req
   * @param res
   */
  @Get('/characters/npc/')
  async getNPC (@Req() req: Request, @Res() res: Response): Promise<any> {
    let size: string = req.query.size as string ?? 'md'
    if (!ALLOWED_SIZE.includes(size)) size = 'md'
    const characters = await this.characterRepo.find()
    // TODO Find a way to have a query builder speed up this process.
    //    As is, this is doubling the result time
    for (const c of characters as any) {
      c.image = `${c.imagePrefix}${size}/${c.imageSuffix}`
      c.imagePrefix = undefined
      c.imageSuffix = undefined
    }
    return res.json(characters)
  }

  /**
   * Get route for the current user's characters
   * Returns all characters, displaying active characters first and inactive characters after
   * @param req
   * @param res
   */
  @Get('/characters/user/')
  async getUserCharacters (@Req() req: Request, @Res() res: Response): Promise<any> {
    const { uID } = req.headers
    if (!uID) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS)
    return await this.customCharacterRepo
      .createQueryBuilder('customChar')
      .leftJoinAndSelect('customChar.creator', 'creator')
      .where('creator.uID LIKE :uID', { uID })
      .addOrderBy('isActive', CustomCharacterController.DESCENDING as 'DESC')
      .getMany()
  }

  /**
   * Get route for characters.
   * Returns a specific character by ID
   * @param id
   * @param res
   */
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

  /**
   * GET route for characters
   * Returns NPC characters, with one character being provided for each stat
   * @param req
   * @param res
   */
  @Get('/character/newroll/')
  async getStatCharacters (@Req() req: Request, @Res() res: Response): Promise<any> {
    const characterCount: number = Object.values(ALLOWED_STATS).length
    const characters: Character[] = await this.characterRepo.createQueryBuilder('character')
      .addOrderBy(RANDOM_FUNCTION)
      .limit(characterCount)
      .getMany()
    if (characters?.length === characterCount) {
      return res.json(characters)
    }
    return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.INTERNAL_SERVER_ERROR, INTERNAL_CHAR_ERR)
  }

  /**
   * PUT route for characters
   * Allows you to change a character's image or name
   * @param req
   * @param res
   */
  @Put('/character/modify/:id')
  async modifyCharacter (@Req() req: Request, @Res() res: Response): Promise<any> {
    const { uID } = req.headers
    if (!uID) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS)
    const id = parseInt(req.params.id) || -1
    if (!id || id < 0) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }
    const customCharacter: CustomCharacter = await this.customCharacterRepo.findOneBy({ id })
    if (!customCharacter) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.ITEM_NOT_FOUND, CHAR_NOT_FOUND)
    }
    const name: string = req.body.name as string || customCharacter.name
    const url: string = req.body.url as string || customCharacter.url
    customCharacter.name = name
    customCharacter.url = url
    return await this.customCharacterRepo.save(customCharacter)
  }

  /**
   * POST route for characters
   * Will take in a nrw character via the request body
   * If errors exist, they will be returned
   * If validation passes, the character will be returned, citing the current user as the creator
   * Wins will be set to 0 and active status will be set to yes
   * @param req
   * @param res
   */
  @Post('/character/new')
  async addCharacter (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    const creator: DiscordUser = await this.userRepo.findOneBy({ uID })
    if (!creator) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS, LOGIN_FAILED)
    }
    const { strength, weight, height, intelligence, power, combat, durability, speed, name, url } = req.body
    const wins: number = 0
    const isActive: boolean = true
    const newCharacter: CustomCharacter = Object.assign(new CustomCharacter(), {
      strength, weight, height, name, intelligence, power, combat, durability, speed, url, wins, creator, isActive
    })
    const violations: ValidationError[] = await validate(newCharacter)
    return violations.length
      ? this.exitWithViolations(res, violations)
      : await this.customCharacterRepo.save(newCharacter)
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
   * PUT route for character rerolls
   * This route should in theory only be called after battles, but no such state check is in place at this time
   * This route takes in an ID and a stat from the URL
   * If id/stats are out of range or not provided, such errors will be displayed
   * If all is successful, character stats will be updated and the character eill be returned in the body as c1, with
   * the donor character returned as c2
   * @param req
   * @param res
   */
  @Put('/character/reroll/')
  async rerollOneStat (@Req() req: Request, @Res() res: Response): Promise<any> {
    const id: number = parseInt(req.query.charID as string)
    if (!id) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    const stat: number = parseInt(req.query.stat as string)
    if (!stat) return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, MISSING_STAT_ERR)
    const statValid: boolean = Object.values(ALLOWED_STATS).map((x: any) => x.index).includes(stat)
    if (!statValid) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, STAT_OUT_OF_RANGE_ERR)
    }
    const statName: string = Object.keys(ALLOWED_STATS)[stat - 1]
    const oldChar: CustomCharacter = await this.customCharacterRepo.findOneBy({ id })
    if (!oldChar) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.ITEM_NOT_FOUND,
      `Character of ID ${id} is not found`)
    }
    if (oldChar.creator.uID !== req.headers.uID) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS, UNAUTHORIZED_ERR)
    }
    if (!oldChar.isActive) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, CHAR_INACTIVE)
    }
    const statCharacter: Character = await this.characterRepo.createQueryBuilder()
      .addOrderBy(RANDOM_FUNCTION)
      .getOne()
    if (!statCharacter) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.INTERNAL_SERVER_ERROR,
        INTERNAL_CHAR_ERR)
    }
    oldChar[statName] = statCharacter[statName]
    await this.customCharacterRepo.save(oldChar)
    return res.json({ c1: oldChar, c2: statCharacter })
  }

  /**
   * PUT route for a character to battle in
   * charID will be taken as a param in the URL
   * If no errors exist, the fight's victory status will be returned as a boolean
   * If the player loses, their character's status will be updated
   * Their hi score will be updated if necessary
   * The player and opponent will be returned as c1 and c2, respectively
   * @param req
   * @param res
   */
  @Put('/character/battle/:charID')
  async battleWithCharacter (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    const id: number = parseInt(req.params.charID) || -1
    if (!uID || id < 0) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST)
    }
    const user: DiscordUser = await this.userRepo.findOneBy({ uID })
    if (!user) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS, LOGIN_FAILED)
    }
    const customChar: CustomCharacter = await this.customCharacterRepo.findOneBy({ id })
    if (!customChar) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.ITEM_NOT_FOUND, CHAR_NOT_FOUND)
    }
    if (customChar.creator.uID !== uID) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS, UNAUTHORIZED_ERR)
    }
    if (!customChar.isActive) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, CHAR_INACTIVE)
    }
    const opponent: Character = await this.characterRepo.createQueryBuilder().addOrderBy(RANDOM_FUNCTION).getOne()
    if (!opponent) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.INTERNAL_SERVER_ERROR)
    }
    const customCharValuePoints: number = this.calculateValuePoints(customChar, 0)
    const opponentValuePoints: number = this.calculateValuePoints(opponent, customChar.wins)
    if (opponentValuePoints > customCharValuePoints) {
      customChar.isActive = false
      await this.customCharacterRepo.save(customChar)
      if (customChar.wins > user.hiScore) {
        user.hiScore = customChar.wins
        await this.userRepo.save(user)
      }
    } else {
      customChar.wins++
      await this.customCharacterRepo.save(customChar)
    }
    return res.json({
      win: customCharValuePoints >= opponentValuePoints,
      c1: customChar,
      c1VP: customCharValuePoints,
      c2: opponent,
      c2VP: opponentValuePoints
    })
  }

  /**
   * Administrative route, to be run only by the ADMIN_USER, as determined by instance environment variables
   * Takes in a URL encoded import url to a character JSON file. It will clear the current character table and import
   * the provided characters. If a character is unprocessable for any reason, they will be displayed in an array with
   * The validation errors. Other characters will be added as normal
   * @param req
   * @param res
   */
  @Put('/characters/import/:importURL')
  async refreshCharacterDatabase (@Req() req: Request, @Res() res: Response): Promise<any> {
    const uID: string = req.headers.uID as string
    const adminUID: string = process.env.ADMIN_USER_ID

    if (uID !== adminUID) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS)
    }
    if (!req.params.importURL) {
      return this.exitWithMessage(res, CustomCharacterController.STATUS_CODES.BAD_REQUEST, CHARACTER_JSON_ERR)
    }
    try {
      const characterArr = await import(req.params.importURL)
      const badCharacters: any[] = []
      const goodCharacters: any[] = []
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
     *  2) Making a request to the Discord API using this authorization header.
     * If the request succeeds, the user's ID, username, displayName, and avatar are returned, delimited by :::
     * If the request fails, null is returned
     * @param head Request header
     * @return {string | null} Discord ID and username or null
     */
  public static async getUser (@Head() head: any): Promise<string | null> {
    const authToken: string = head.authorization?.toString()
    const delim = CustomCharacterController.DELIM
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
          : DEFAULT_PFP
        const displayName = discordUser.displayName ?? ''
        return `${discordUser.id}${delim}${discordUser.username}${delim}${displayName}${delim}${avatarLink}`
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
    sortOptions.order = CustomCharacterController.DESCENDING_OPTIONS
      .includes((req.query.sortorder as string)?.toUpperCase())
      ? CustomCharacterController.DESCENDING
      : CustomCharacterController.ASCENDING
    return sortOptions
  }

  /**
   * This function takes in a Character or CustomCharacter and returns their value points
   * @param character
   * @param wins
   */
  calculateValuePoints (character: CustomCharacter | Character, wins: number): number {
    let returnVP: number = 0
    let modifier: number = 0
    for (let i: number = wins; i > 0; i++) {
      modifier += i
    }
    returnVP += Math.min(character.height + modifier, ALLOWED_STATS.height.maxValue) * ALLOWED_STATS.height.multiplier
    returnVP += Math.min(character.weight + modifier, ALLOWED_STATS.weight.maxValue) * ALLOWED_STATS.weight.multiplier
    returnVP += (character.combat + modifier) * ALLOWED_STATS.combat.multiplier
    returnVP += (character.strength + modifier) * ALLOWED_STATS.strength.multiplier
    returnVP += (character.speed + modifier) * ALLOWED_STATS.speed.multiplier
    returnVP += (character.intelligence + modifier) * ALLOWED_STATS.intelligence.multiplier
    returnVP += (character.power + modifier) * ALLOWED_STATS.power.multiplier
    returnVP += (character.durability + modifier) * ALLOWED_STATS.durability.multiplier
    return returnVP
  }
}
