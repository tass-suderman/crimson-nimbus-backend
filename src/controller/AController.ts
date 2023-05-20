import { Controller, Head, Req } from 'routing-controllers'
import fetch, { Headers } from 'node-fetch'
import { ValidationError } from 'class-validator'
import { Request, Response } from 'express'

const DISCORD_URL: string = 'https://discord.com/api/v9/users/@me'
const AUTHORIZATION_HEADER: string = 'Authorization'

@Controller()
export abstract class AController {
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
  public static readonly DELIM: string = ':'

  public abstract readonly SORT_FIELDS: string[]

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
        return `${discordUser.id}${AController.DELIM}${discordUser.username}${AController.DELIM}${displayName}${AController.DELIM}${avatarLink}`
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
    res.statusCode = AController.STATUS_CODES.UNPROCESSABLE_ENTITY.code
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
    sortOptions.order = AController.DESCENDING_OPTIONS.includes((req.query.sortorder as string)?.toUpperCase()) // if broky look here
      ? AController.DESCENDING
      : AController.ASCENDING
    return sortOptions
  }
}
