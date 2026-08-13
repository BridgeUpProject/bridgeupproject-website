const finalhandler = require('finalhandler')
const http = require('http')
const serveStatic = require('serve-static')

// Mirrors the production routing in vercel.json: clean URLs
// (`/programs` serves programs.html) and no trailing slash.
const serve = serveStatic('./', { index: ['index.html'], extensions: ['html'] })

const LEGACY = {
  '/homepage_mockup.html': '/',
  '/programs_mockup.html': '/programs',
  '/about_us_mockup.html': '/about',
  '/connect_with_us_mockup.html': '/connect'
}

function redirect(res, location) {
  res.writeHead(308, { Location: location })
  res.end()
}

// Create server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  if (LEGACY[path]) return redirect(res, LEGACY[path] + url.search)

  // `/programs.html` and `/programs/` both settle on `/programs`
  if (path.length > 1 && path.endsWith('/')) {
    return redirect(res, path.replace(/\/+$/, '') + url.search)
  }
  if (path.endsWith('.html') && path !== '/index.html') {
    return redirect(res, path.slice(0, -5) + url.search)
  }
  if (path === '/index.html') return redirect(res, '/' + url.search)

  serve(req, res, finalhandler(req, res))
})

// Listen
const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Serving on http://localhost:${port}`)
})
