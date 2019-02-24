const fs = require('fs')
const url = require('url')
const http = require('http')
const https = require('https')
const mediatypes = require('./mediatypes')
const reader = require('./reader')

if (typeof window === 'undefined') {
  const xmldom = require('xmldom')
  global.DOMParser = xmldom.DOMParser
  global.XMLSerializer = xmldom.XMLSerializer
}

function parse (sourcePath, {base = null, type = null, encoding = 'utf-8'} = {}) {
  return new Promise(function (resolve, reject) {
    function handleStream (stream) {
      if (String(stream.statusCode).match(/^30[123578]$/)) {
        let location = stream.headers['location']
        // `Following ${stream.statusCode} redirect to ${location}
        getUrl(url.parse(location), handleStream)
        return
      }
      let mediaType = mediatypes.suffixMediaTypeMap[type] || type
      if (stream.headers != null) {
        let ctype = stream.headers['content-type']
        let match = ctype.match(/([^;]+)(?:\s*;\s*charset=([^,;]+))?/)
        mediaType = mediaType || match[1]
        encoding = encoding || match[2]
      } else {
        mediaType = mediaType || mediatypes.guessMediaType(sourcePath)
      }

      let transcriber = reader.transcribers[mediaType]

      let bufs = []
      stream.on('data', d => { bufs.push(d) })
      stream.on('end', () => {
        let buf = Buffer.concat(bufs)
        let str
        try {
          // Two problems may occur: unknown or wrong encoding
          str = buf.toString(encoding)
        } catch (e) {
          str = buf.toString('utf-8')
        }

        let result = transcriber(str, base || sourcePath, mediaType)
        resolve(result)
      })
    }

    let urlObj = sourcePath ? url.parse(sourcePath) : null
    if (urlObj && urlObj.protocol != null) {
      getUrl(urlObj, handleStream)
    } else {
      let stream =
        (!sourcePath || sourcePath === '-') ? process.stdin
        : fs.createReadStream(sourcePath)
      handleStream(stream)
    }
  })
}

function getUrl (urlObj, handleStream) {
  let headers = reader.getHeaders()
  let options = Object.assign({headers: headers}, urlObj)
  const mod = urlObj.protocol.startsWith('https') ? https : http
  mod.get(options, handleStream)
}

module.exports = {parse}
