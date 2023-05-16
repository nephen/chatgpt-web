import jwt from 'jsonwebtoken'
import { isNotEmptyString } from '../utils/is'

const auth = async (req, res, next) => {
  const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
  if (isNotEmptyString(AUTH_SECRET_KEY)) {
    try {
      const authorizationHeader = req.header('Authorization')
      if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
        const token = authorizationHeader.substring(7)
        jwt.verify(token, AUTH_SECRET_KEY, (err, user) => {
          if (err) {
            globalThis.console.log(err)
            throw new Error('Error: 无访问权限 | No access rights')
          }
          req.user = user
          next()
        })
      }
      else {
        throw new Error('Error: 没有提供token | No token provided')
      }
    }
    catch (error) {
      res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
    }
  }
  else {
    next()
  }
}

export { auth }
