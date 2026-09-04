import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Dev only: the browser can POST a data-URL frame to /__frame?name=x and it is
 * written to FRAME_DIR. Lets the world be inspected as image files when the
 * preview pane cannot be screenshotted.
 */
function frameSink(): Plugin {
  return {
    name: 'frame-sink',
    apply: 'serve',
    configureServer(server) {
      const dir = process.env.FRAME_DIR || join(process.cwd(), '.frames')
      mkdirSync(dir, { recursive: true })
      server.middlewares.use('/__frame', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        const name = new URL(req.url || '', 'http://x').searchParams.get('name') || 'frame'
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          const b64 = body.replace(/^data:image\/\w+;base64,/, '')
          const file = join(dir, `${name.replace(/[^a-z0-9_-]/gi, '')}.jpg`)
          writeFileSync(file, Buffer.from(b64, 'base64'))
          res.setHeader('content-type', 'text/plain')
          res.end(file)
        })
      })
    },
  }
}

export default defineConfig({
  server: { port: 5174, strictPort: true },
  plugins: [react(), frameSink()],
})
