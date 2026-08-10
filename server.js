const finalhandler = require('finalhandler')
const http = require('http')
const serveStatic = require('serve-static')

// Serve up root directory
const serve = serveStatic('./', { index: ['homepage_mockup.html'] })

// Create server
const server = http.createServer((req, res) => {
  serve(req, res, finalhandler(req, res))
})

// Listen
const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Serving on http://localhost:${port}`)
})