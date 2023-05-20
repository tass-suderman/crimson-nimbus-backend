import { Controller, Delete, Get, Param, Post, Put, Req, Res } from 'routing-controllers'
import { AppDataSource } from '../data-source'
import { Character } from '../entity/Character'
import { validate, ValidationError } from 'class-validator'
import { Request, Response } from 'express'
import { AController } from './AController'
import { CustomCharacter } from '../entity/CustomCharacter'
import { DiscordUser } from '../entity/DiscordUser'

//Maybe this should be a map or somehthing. its giving me weird vibes
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
const STAT_OUT_OF_RANGE_ERR = `Stat index must be between 0 and ${Object.values(ALLOWED_STATS).length}`
const UNAUTHORIZED_ERR: string = 'Only the character\'s creator can make changes'


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
  async getOneMeme (@Param('id') id: number, @Res() res: Response): Promise<any> {
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
  async post (@Req() req: Request, @Res() res: Response): Promise<any> {
    const id:number = parseInt(<string>req.query.charID)
    if(!id) return this.exitWithMessage(res,AController.STATUS_CODES.BAD_REQUEST,MISSING_ID_ERR)
    const stat:number= parseInt(<string>req.query.stat)
    if(!stat) return this.exitWithMessage(res,AController.STATUS_CODES.BAD_REQUEST,MISSING_STAT_ERR)
    const statValid :boolean = Object.values(ALLOWED_STATS).includes(stat)
    const oldChar : CustomCharacter = await this.customCharacterRepo.findOneBy({id})
    if(!oldChar) return this.exitWithMessage(res,AController.STATUS_CODES.ITEM_NOT_FOUND,`Character of ID ${id} is not found`)
    if(oldChar.creator.uID!==req.headers.uID)
    {
      return this.exitWithMessage(res,AController.STATUS_CODES.UNAUTHORIZED_STATUS,UNAUTHORIZED_ERR)
    }
    const newChar : CustomCharacter = this.
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
    const user: registereduser =
      object.assign(new registereduser(), { uid: req.headers.uid, username: req.headers.username })

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
