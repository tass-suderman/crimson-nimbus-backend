import * as express from 'express'
import * as bodyParser from 'body-parser'
import { AppDataSource } from './data-source'
import * as cors from 'cors'
import { useExpressServer } from 'routing-controllers'
import { NextFunction, Request, Response } from 'express'
import { CustomCharacterController } from './controller/CustomCharacterController'
import { config } from 'dotenv'
config()
// Backend server port
const port: number = parseInt(process.env.PORT) || 7455

const NOT_LOGGED_IN_ERR: string = 'You must be logged in to a discord session to perform this action'
const ROUTE_NOT_FOUND_ERR: string = 'Route not found'
const ROUTE_NOT_FOUND: any = {
  code: CustomCharacterController.STATUS_CODES.ITEM_NOT_FOUND.code,
  message: ROUTE_NOT_FOUND_ERR
}

// CORS options
const corsOptions = {
  origin: /(localhost:\d{4,5}|.*appspot.*)$/i,
  credentials: true,
  allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
  methods: 'GET,PUT,POST'
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
  const userInfo: string = await CustomCharacterController.getUser(req.headers)
  if (userInfo) {
    const userFields: string[] = userInfo.split(CustomCharacterController.DELIM)
    req.headers.uID = userFields[0]
    req.headers.userName = userFields[1]
    req.headers.displayName = userFields[2]
    req.headers.avatar = userFields[3]
    next()
  } else {
    return res.json({
      code: CustomCharacterController.STATUS_CODES.UNAUTHORIZED_STATUS.code,
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
    res.statusCode = CustomCharacterController.STATUS_CODES.ITEM_NOT_FOUND.code
    return res.json(ROUTE_NOT_FOUND)
  }
}

AppDataSource.initialize().then(async () => {
  // app setup
  const app = express()
  app.use(bodyParser.json())
  app.use(cors(corsOptions))

  app.use(ACCOUNT_CHECKER)

  useExpressServer(app, { controllers: [CustomCharacterController] })

  app.use(NOT_FOUND_HANDLER)

  app.listen(port)
  console.log(`Server is listening on port ${port}`)
}).catch(error => console.log(error))
