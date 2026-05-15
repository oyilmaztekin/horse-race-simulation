import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { db } from './db'
import { createHorsesRouter } from './routes/horses'
import { createRoundsRouter } from './routes/rounds'
import { resolveBindConfig } from './bindConfig'

const app = new Hono()
app.route('/api/horses', createHorsesRouter(db))
app.route('/api/rounds', createRoundsRouter(db))

const { host, port } = resolveBindConfig(process.env)
serve({ fetch: app.fetch, hostname: host, port })
