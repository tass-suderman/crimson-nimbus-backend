/**
 * @author Tass Suderman, Levi Krozser
 */
import * as express from 'express'
import * as bodyParser from 'body-parser'
import { AppDataSource } from './data-source'
import * as cors from 'cors'
import { MemeController } from './controller/MemeController'
import { CommandController } from './controller/CommandController'
import { TagController } from './controller/TagController'
import { AController } from './controller/AController'
import { useExpressServer } from 'routing-controllers'
import { NextFunction, Request, Response } from 'express'

// Backend server port
const port: number = 3030

const NOT_LOGGED_IN_ERR: string = 'You must be logged in to a discord session to perform this action'
// todo maybe ? https://github.com/typestack/routing-controllers#using-authorization-features
const ROUTE_NOT_FOUND_ERR: string = 'Route not found'
const ROUTE_NOT_FOUND: any = { code: AController.STATUS_CODES.ITEM_NOT_FOUND.code, message: ROUTE_NOT_FOUND_ERR }

// CORS options
const corsOptions = {
  origin: /localhost:\d{4,5}$/i,
  credentials: true,
  allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
  methods: 'GET,PUT,POST,DELETE'
}

/**
 * This function is used as a handler for all incoming requests.
 * It passes the headers into our function used to fetch a user from discord via their bearer token
 * If that check returns correctly, their user info is appended to the request headers
 * If it fails, the request is turned away with an unauthorized status code and an error message
 * If it succeeds, we pass the request down to the next handler
 * @param req Client Request
 * @param res Server response
 * @param next Next function to be executed
 */
const ACCOUNT_CHECKER = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const userInfo: string = await AController.getUser(req.headers)
  if (userInfo) {
    const userFields: string[] = userInfo.split(AController.DELIM)
    req.headers.uID = userFields[0]
    req.headers.userName = userFields[1]
    next()
  } else {
    return res.json({
      code: AController.STATUS_CODES.UNAUTHORIZED_STATUS.code,
      message: NOT_LOGGED_IN_ERR
    })
  }
}

/**
 * This function is used as a handler for cases wherein another route is not used. This typically means the user has
 * entered an invalid URL. In this case, we first ensure headers have not been sent to the client. This acts as a second
 * layer of fault tolerance to ensure we are not reaching this handler after a request has been addressed.
 * If headers have not been sent, it is fair to assume that the client's request has not been tended to. In this instance
 * we will set the status code to 404 and inform the user that their request has not been fulfilled
 * @param req Client Request
 * @param res Server response
 */
const NOT_FOUND_HANDLER = async (req: Request, res: Response): Promise<any> => {
  if (!res.headersSent) {
    res.statusCode = AController.STATUS_CODES.ITEM_NOT_FOUND.code
    return res.json(ROUTE_NOT_FOUND)
  }
}

const controllers: Array<typeof AController> = [MemeController, CommandController, TagController]

AppDataSource.initialize().then(async () => {
  // app setup
  const app = express()
  app.use(bodyParser.json())
  app.use(cors(corsOptions))

  // first use the account checker
  app.use(ACCOUNT_CHECKER)

  // then the controllers
  useExpressServer(app, { controllers })

  // if the controllers do not fulfill your request, you receive a 404 for your efforts
  app.use(NOT_FOUND_HANDLER)

  app.listen(port)
}).catch(error => console.log(error))
