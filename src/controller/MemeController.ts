/**
 * @author Tass Suderman, Levi Krozser
 * * GET -- returns all memes
 *  *        -- supports sortorder, sortby, and where
 *  * GET One -- Returns one meme based on memeID
 *  * POST -- Adds a meme
 *  *         -- Requires mDescription, mImageRoute, tags
 *  * PUT -- Updates a meme
 *  *         -- Requires mDescription, mImageRoute, tags
 *  *         -- Requires memeID in params
 *  *         -- Can only be changed by meme creator
 *  * DELETE -- Deletes a meme
 *  *         -- Requires memeID in params
 *  *         -- Can only be performed by meme creator
 * */

import { Controller, Delete, Get, Param, Post, Put, Req, Res } from 'routing-controllers'
import { AppDataSource } from '../data-source'
import { RegisteredUser } from '../entity/DiscordUser'
import { Meme } from '../entity/Meme'
import { validate, ValidationError } from 'class-validator'
import { Request, Response } from 'express'
import { AController } from './AController'

const MISSING_ID_ERR: string = 'ID must be provided and numeric'

const EDIT_UNAUTHORIZED_ERR: string = 'Only the meme creator can update their command'
const DELETE_UNAUTHORIZED_ERR: string = 'Only the meme creator can delete their command'
const CONFLICT_ERR: string = 'Cannot delete a meme which is used in commands.'

@Controller()
export class MemeController extends AController {
  public override readonly SORT_FIELDS = ['memeID', 'mCreator', 'mCreator.userName']

  private readonly memeRepo = AppDataSource.getRepository(Meme)

  /**
   * GET Route handler for /memes
   * Returns memes, sorted or filtered, if requested.
   * By default, it returns all memes, sorted in ascending order by ID
   * Defining sortby can change the field it sorts by (see SORT_FIELDS for acceptable options)
   * Declaring descending in sortorder can make it sort in descending order instead
   * (See DESCENDING_OPTIONS in AController for more)
   * Declaring where and adding any number of characters will filter to meme results where they are LIKE the where value
   * After the GET options are parsed, the results are returned in an array
   * @param req Client Request
   */
  @Get('/memes/')
  async getMemes (@Req() req: Request): Promise<any> {
    const where: string = req.query.where as string ?? '%'
    const queryWhere: string = `%${where}%`
    const sortOptions: any = this.getSortOptions(req)
    return await this.memeRepo
      .createQueryBuilder('meme')
      .leftJoinAndSelect('meme.mCreator', 'mCreator')
      .leftJoinAndSelect('meme.tags', 'tags')
      .where('mCreator.userName LIKE :queryWhere', { queryWhere })
      .orWhere('mCreator.uID LIKE :queryWhere', { queryWhere })
      .orWhere('tags.tagName LIKE :queryWhere', { queryWhere })
      .orWhere('mDescription LIKE :queryWhere', { queryWhere })
      .addOrderBy(sortOptions.field, sortOptions.order)
      .getMany()
  }

  /**
   * GET route handler for /memes/:memeID
   * Route Paths:
   * 1) No Meme ID Provided / invalid Meme ID Provided => Exit with status 400
   * 2) No meme associated with provided ID => Exit with status 404
   * 3) Meme successfully retrieved => return meme
   * @param memeID ID of the meme to return
   * @param res Server Response
   */
  @Get('/memes/:memeID')
  async getOneMeme (@Param('memeID') memeID: number, @Res() res: Response): Promise<any> {
    if (!memeID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }
    const returnMeme: Meme = await this.memeRepo.findOneBy({ memeID })

    if (!returnMeme) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND,
        `Meme of ID ${memeID} is not found`)
    }
    return res.json(returnMeme)
  }

  /**
   * POST handler for /memes/
   * Used to create and save Meme objects
   * Constructs meme, and checks for validation errors
   * If validation passes, save it and return the result
   * If validation fails, return the violations with status code 422
   * @param req Client Request
   * @param res Server Response
   */
  @Post('/memes/')
  async post (@Req() req: Request, @Res() res: Response): Promise<any> {
    const newMeme: Meme = await this.memeBuilder(req, res)
    newMeme.mCreator = Object.assign(new RegisteredUser(), { uID: req.headers.uID, userName: req.headers.userName })
    const violations: ValidationError[] = await validate(newMeme)
    if (violations.length) {
      return this.exitWithViolations(res, violations)
    }
    return await this.memeRepo.save(newMeme)
  }

  /**
   * PUT handler for /memes/:memeID
   * Used to modify and update saved memes.
   * The paths that the code can take
   * 1) No Meme ID / Invalid Meme ID => Exit with status 400
   * 2) Meme ID doesn't point to an existing command => Exit with Error 404
   * 3) Meme Creator does not match logged in creator => Exit with Error 401
   * 4) Meme edits introduce validation errors => Exit with Error 422 and validation error messages
   * 5) All is well => Meme is saved and returned
   * @param memeID ID of the meme to be updated
   * @param req Client request
   * @param res Server response
   */
  @Put('/memes/:memeID')
  async update (@Param('memeID') memeID: number, @Req() req: Request, @Res() res: Response): Promise<any> {
    if (!memeID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }
    const user: RegisteredUser =
      Object.assign(new RegisteredUser(), { uID: req.headers.uID, userName: req.headers.userName })

    const oldMeme: Meme = await this.memeRepo.findOneBy({ memeID })
    if (!oldMeme) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND, `Meme of ID ${memeID} is not found`)
    }

    if (user.uID !== oldMeme.mCreator.uID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.UNAUTHORIZED_STATUS,
        EDIT_UNAUTHORIZED_ERR)
    }
    const newMeme: Meme = await this.memeBuilder(req, res)
    const violations: ValidationError[] = await validate(newMeme)
    if (violations.length) {
      return this.exitWithViolations(res, violations)
    }
    newMeme.memeID = oldMeme.memeID
    return await this.memeRepo.save(newMeme)
  }

  /**
   * DELETE Route handler for /memes/:memeID
   * Takes in request, response, and param
   * Paths are as follows
   * 1) Meme ID invalid / not provided => Exit with Error 400
   * 2) Meme ID provided does not point to a valid command => Exit with Error 404
   * 3) Logged-in user does not match the meme creator => Exit with Error 401
   * 4) Deleting selected meme would cause conflicts with commands => Exit with Error 409
   * 5) All is well. Delete command and return results
   * @param memeID ID of command to be deleted
   * @param req Client Request
   * @param res Server Response
   */
  @Delete('/memes/:memeID')
  async delete (@Param('memeID') memeID: number, @Req() req: Request, @Res() res: Response): Promise<any> {
    if (!memeID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
    }

    const user: RegisteredUser =
      Object.assign(new RegisteredUser(), { uID: req.headers.uID, userName: req.headers.userName })

    const memeToRemove: Meme = await this.memeRepo.findOneBy({ memeID: parseInt(req.params.memeID) })
    if (!memeToRemove) {
      return this.exitWithMessage(res, AController.STATUS_CODES.ITEM_NOT_FOUND, `Meme of ID ${memeID} is not found`)
    }
    if (user.uID !== memeToRemove.mCreator.uID) {
      return this.exitWithMessage(res, AController.STATUS_CODES.UNAUTHORIZED_STATUS,
        DELETE_UNAUTHORIZED_ERR)
    }
    try {
      res.statusCode = AController.STATUS_CODES.NO_CONTENT.code
      return await this.memeRepo.remove(memeToRemove)
    } catch (e) {
      return this.exitWithMessage(res, AController.STATUS_CODES.CONFLICT,
        CONFLICT_ERR)
    }
  }

  /**
   * DELETE Route handler for /memes/
   * Only used when ID is not provided.
   * Returns error 400
   * @param res Server Response
   */
  @Delete('/memes/')
  async deleteNoID (@Res() res: Response): Promise<any> {
    return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
  }

  /**
   * PUT Route handler for /memes/
   * Only used when ID is not provided.
   * Returns error 400
   * @param res Server Response
   */
  @Put('/memes/')
  async updateNoID (@Res() res: Response): Promise<any> {
    return this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST, MISSING_ID_ERR)
  }

  /**
   * This function takes in a request and response, and works to build meme objects as they exist thus far.
   * Once constructed and validated, it is returned to the appropriate route.
   * @param req Client request
   * @param res Server response
   */
  async memeBuilder (req: Request, res: Response): Promise<Meme> {
    const newMeme: Meme = Object.assign(new Meme(),
      {
        mDescription: req.body.mDescription,
        mImageRoute: req.body.mImageRoute
      })
    if (req.body?.tags[0]) {
      if (req.body.tags[0] instanceof String) {
        const tags: string[] = req.body.tags
        newMeme.tags = await this.buildTags(tags)
      } else {
        newMeme.tags = req.body.tags
      }
      return newMeme
    } else {
      this.exitWithMessage(res, AController.STATUS_CODES.BAD_REQUEST.code, 'Tags must be provided')
    }
  }
}
