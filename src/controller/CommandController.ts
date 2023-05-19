/**
* @author Tass Suderman, Levi Krozser
 * Routes:
 * GET -- returns all commands
 *        -- supports sortorder, sortby, and where
 * GET One -- Returns one command based on commandID
 * POST -- Adds a command
 *         -- Requires cName, cText, memeID
 * PUT -- Updates a command
 *         -- Requires cName, cText, memeID
 *         -- Requires commandID in params
 *         -- Can only be changed by command creator
 * DELETE -- Deletes a command
 *         -- Requires commmandID in params
 *         -- Can only be performed by command creator
*/

import { Controller, Delete, Get, Param, Post, Put, Req, Res } from 'routing-controllers'
import { AController } from './AController'
import { Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { Character } from '../entity/Character'
import { validate, ValidationError } from 'class-validator'
import { Meme } from '../entity/Meme'
import { RegisteredUser } from '../entity/DiscordUser'

// Defines what would replace a self reference and other person reference
const mentionSelfRef: string = '$self'
const mentionHead: string = '$mention'
const mentionTails: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'A', 'B', 'C', 'D', 'E', 'F']
const MISSING_ID_ERR: string = 'ID must be provided and numeric'
const MISSING_MEMEID_ERR: string = 'Invalid body sent. Check your memeID'
const EDIT_UNAUTHORIZED_ERR: string = 'Only the command creator can update their command'
const DELETE_UNAUTHORIZED_ERR: string = 'Only the command creator can delete their command'

@Controller()
export class CommandController extends AController {
  public override readonly SORT_FIELDS: string[] =
    ['commandID', 'cName', 'cNumMentions', 'cCreator', 'cCreator.userName']

  private readonly commandRepo = AppDataSource.getRepository(Character)
  private readonly memeRepo = AppDataSource.getRepository(Meme)

  /**
   * GET Route handler for /commands
   * Returns commands, sorted or filtered, if requested.
   * By default, it returns all commands, sorted in ascending order by ID
   * Defining sortby can change the field it sorts by (see SORT_FIELDS for acceptable options)
   * Declaring descending in sortorder can make it sort in descending order instead
   * (See DESCENDING_OPTIONS in AController for more)
   * Declaring where and adding any number of characters will filter to command results where they are LIKE the where value
   * After the GET options are parsed, the results are returned in an array
   * @param req Client Request
   */
  @Get('/commands/')
  async getCommands (@Req() req: Request): Promise<Character[]> {
    const where: string = req.query.where as string ?? '%'
    const queryWhere: string = `%${where}%`
    const sortOptions: any = this.getSortOptions(req)
    return await this.commandRepo
      .createQueryBuilder('command')
      .leftJoinAndSelect('command.cCreator', 'cCreator')
      .leftJoinAndSelect('command.meme', 'meme')
      .where('cCreator.userName LIKE :queryWhere', { queryWhere })
      .orWhere('cCreator.uID LIKE :queryWhere', { queryWhere })
      .orWhere('cNumMentions LIKE :queryWhere', { queryWhere })
      .orWhere('cName LIKE :queryWhere', { queryWhere })
      .orWhere('cText LIKE :queryWhere', { queryWhere })
      .addOrderBy(sortOptions.field, sortOptions.order)
      .getMany()
  }

  /**
   * GET Route handler for /commands/:commandID
   * Takes in a parameter, defining the requested command ID.
   * If the CommandID is not a number or is otherwise not provided, it returns a 400 Bad request status
   * It then searches for a command with that ID
   * If it exists, it is returned as JSON.
   * Else, a 404 is returned.
   * @param commandID commandID to search for
   * @param res Server Response
   */
  @Get('/commands/:commandID')
  async getOneCommand (@Param('commandID') commandID: number, @Res() res: Response): Promise<Character | any> {
    if (!commandID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }
    const returnCommand: Character = await this.commandRepo.findOneBy({ commandID })

    if (!returnCommand) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND,
          `Command of ID ${commandID} is not found`)
    }
    return res.json(returnCommand)
  }

  /**
   * POST handler for /commands/
   * Used to create and save Character objects
   * There are three paths that this code block can take
   * 1) No meme ID Provided => Exit with bad request error code and message
   * 2) Character provided fails validation => Exit with unprocessable entity and error messages
   * 3) All goes as planned => Create and save command. Return it as JSON.
   * @param req Client Request
   * @param res Server Response
   */
  @Post('/commands/')
  async post (@Req() req: Request, @Res() res: Response): Promise<Character | ValidationError[]> {
    if (!req.body?.memeID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_MEMEID_ERR)
    }

    const userFields: any = {
      uID: req.headers.uID, userName: req.headers.userName
    }
    const user: RegisteredUser = Object.assign(new RegisteredUser(), userFields)
    const newCommand: Character = await this.commandBuilder(req, res, user)
    const violations: ValidationError[] = await validate(newCommand)
    if (violations.length) {
      return this.exitWithViolations(res, violations)
    }
    return await this.commandRepo.save(newCommand)
  }

  /**
   * PUT handler for /commands/:commandID
   * Used to modify and update saved commands.
   * The paths that the code can take
   * 1) No command ID / Invalid command ID => Exit with status 400
   * 2) Character ID doesn't point to an existing command => Exit with Error 404
   * 3) Character Creator does not match logged in creator => Exit with Error 401
   * 4) Character edits introduce validation errors => Exit with Error 422 and validation error messages
   * 5) All is well => Character is saved and returned
   * @param commandID ID of the command to be updated
   * @param req Client request
   * @param res Server response
   */
  @Put('/commands/:commandID')
  async update (@Param('commandID') commandID: number, @Req() req: Request, @Res() res: Response): Promise<any> {
    if (!commandID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }
    const user: RegisteredUser =
        Object.assign(new RegisteredUser(), { uID: req.headers.uID, userName: req.headers.userName })
    const commandToUpdate: Character = await this.commandRepo.findOneBy({ commandID })
    if (!commandToUpdate) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND,
          `Command of ID ${commandID} is not found`)
    }
    if (user.uID !== commandToUpdate.cCreator.uID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.UNAUTHORIZED_STATUS,
        EDIT_UNAUTHORIZED_ERR)
    }
    const newCommand: Character = await this.commandBuilder(req, res, user)
    const violations: ValidationError[] = await validate(newCommand)
    if (violations.length) {
      return this.exitWithViolations(res, violations)
    }
    newCommand.commandID = commandToUpdate.commandID
    return await this.commandRepo.save(newCommand)
  }

  /**
   * DELETE Route handler for /commands/:commandID
   * Takes in request, response, and param
   * Paths are as follows
   * 1) Character ID invalid / not provided => Exit with Error 400
   * 2) Character ID provided does not point to a valid command => Exit with Error 404
   * 3) Logged-in user does not match the command creator => Exit with Error 401
   * 4) All is well. Delete command and return results
   * @param commandID ID of command to be deleted
   * @param req Client Request
   * @param res Server Response
   */
  @Delete('/commands/:commandID')
  async delete (@Param('commandID') commandID: number, @Req() req: Request, @Res() res: Response): Promise<any> {
    if (!commandID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }

    const user: RegisteredUser =
        Object.assign(new RegisteredUser(), { uID: req.headers.uID, userName: req.headers.userName })

    const commandToRemove: Character = await this.commandRepo.findOneBy({ commandID: parseInt(req.params.commandID, 10) }) // if things get broky look at this line
    if (!commandToRemove) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND,
          `Command of ID ${commandID} is not found`)
    }
    if (user.uID !== commandToRemove.cCreator.uID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.UNAUTHORIZED_STATUS,
        DELETE_UNAUTHORIZED_ERR)
    }
    res.statusCode = AController.STATUS_CODES.NO_CONTENT.code // delete me if broky
    return await this.commandRepo.remove(commandToRemove)
  }

  /**
   * DELETE Route handler for /commands/
   * Only used when ID is not provided.
   * Returns error 400
   * @param res Server Response
   */
  @Delete('/commands/')
  async deleteNoID (@Res() res: Response): Promise<any> {
    return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
  }

  /**
   * PUT Route handler for /commands/
   * Only used when ID is not provided.
   * Returns error 400
   * @param res Server Response
   */
  @Put('/commands/')
  async updateNoID (@Res() res: Response): Promise<any> {
    return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
  }

  /**
   * This function takes in the text of a command and returns some command metadata used for functional
   * tasks later on. Counts number of distinct mentioned users and whether or not a user wants to mention themself
   * @param commandText Text to be looked through
   */
  commandParser (commandText: String): any {
    const mentionsUser: boolean = commandText.includes(mentionSelfRef)
    let numMentions: number = 0
    for (const tail of mentionTails) {
      if (commandText.includes(mentionHead + tail)) {
        numMentions++
      }
    }
    return { cNumMentions: numMentions, cMentionsUser: mentionsUser }
  }

  /**
   * This function takes in a request, response, and user object, and does the bulk of building the command object.
   * Once built, it is returned to the appropriate route.
   * @param req Client Request
   * @param res Server Response
   * @param user Logged-in user
   */
  async commandBuilder (req: Request, res: Response, user: RegisteredUser): Promise<Character | any> {
    const meme: Meme = await this.memeRepo.findOneBy({ memeID: req.body.memeID })
    if (!meme) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND,
          `Meme with ID ${req.body.memeID} not found.`)
    }
    const commandData: any =
        req.body.cText ? this.commandParser(req.body.cText) : { cNumMentions: 0, cMentionsUser: false }

    const commandFields: any = {
      cName: req.body.cName,
      cText: req.body.cText,
      cMentionsUser: commandData.cMentionsUser,
      cNumMentions: commandData.cNumMentions
    }
    const newCommand: Character = Object.assign(new Character(), commandFields)
    newCommand.meme = meme
    newCommand.cCreator = user
    return newCommand
  }
}
