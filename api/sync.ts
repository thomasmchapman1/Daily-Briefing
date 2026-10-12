// Vercel serverless function for the fitness log's cloud sync (see server/sync.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleSync } from '../server/sync.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const key = req.headers['x-sync-key']
    const out = await handleSync(req.method ?? 'GET', Array.isArray(key) ? key[0] : key, body)
    return res.status(out.status).json(out.json)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Sync failed' })
  }
}
