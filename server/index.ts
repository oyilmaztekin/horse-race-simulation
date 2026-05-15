import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { db } from './db'
import { createHorsesRouter } from './routes/horses'
import { createRoundsRouter } from './routes/rounds'

const app = new Hono()
app.route('/api/horses', createHorsesRouter(db))
app.route('/api/rounds', createRoundsRouter(db))

serve({ fetch: app.fetch, port: 3001 })
