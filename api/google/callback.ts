import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleGoogle } from '../../server/google.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleGoogle('callback', req, res)
}
