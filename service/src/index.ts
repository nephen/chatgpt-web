import express from 'express'
import jwt from 'jsonwebtoken'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'

const app = express()
const router = express.Router()

app.use(express.static('public'))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { prompt, options = {}, systemMessage, temperature, top_p } = req.body as RequestProps
    let firstChunk = true
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
      temperature,
      top_p,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/gentoken', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    const { key, time, userId = 1 } = req.body as { key: string; time: number; userId?: number }
    if (key !== AUTH_SECRET_KEY)
      throw new Error('key无效 | Key is invalid')

    if (hasAuth) {
      // 从请求中获取用户信息或任何其他必要的数据
      const user = {
        id: userId,
      }
      // 生成带有过期时间的 JWT 令牌
      const token = jwt.sign(user, AUTH_SECRET_KEY, { expiresIn: `${time}h` })
      // 将生成的令牌发送回客户端
      res.json({ token })
    }
    else {
      throw new Error('无需设置密钥 | No need to set token')
    }
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')
    jwt.verify(token, AUTH_SECRET_KEY, (err, decodedToken) => {
      if (err) {
        throw new Error('密钥无效 | Secret key is invalid')
      }
      else {
        const { exp } = decodedToken
        globalThis.console.log('Expiration time:', new Date(exp * 1000))
      }
    })

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
