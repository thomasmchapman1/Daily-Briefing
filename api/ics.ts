// Vercel serverless function: POST { url, start, end, date } → { events }.
// ICS links can't be fetched from the browser (CORS), so this proxies and parses.
// The private link travels in the request body so it stays out of access logs.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { IcsError, handleIcsRequest } from '../server/icsEvents.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    return res.status(200).json(await handleIcsRequest(body))
  } catch (err) {
    const status = err instanceof IcsError ? err.status : 500
    const message = err instanceof IcsError ? err.message : 'Calendar could not be read'
    return res.status(status).json({ error: message })
  }
}
