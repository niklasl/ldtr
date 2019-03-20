import fs from 'fs'
import url from 'url'
import http from 'http'
import https from 'https'

import './setup.js'
import * as mediatypes from './mediatypes.js'
import * as reader from './reader.js'

export function read (sourcePath, opts = {}) {
  let {base = null, type = null, encoding = 'utf-8'} = opts

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
      stream.on('end', async () => {
        let buf = Buffer.concat(bufs)
        let str
        try {
          // Two problems may occur: unknown or wrong encoding
          str = buf.toString(encoding)
        } catch (e) {
          str = buf.toString('utf-8')
        }

        let result = await transcriber(str, base || sourcePath, mediaType)
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

export async function write (data, opts = {}) {
  let { type = null } = opts

  const {suffixMediaTypeMap} = await import('./mediatypes')

  let mediaType = suffixMediaTypeMap[type] || type
  if (mediaType === suffixMediaTypeMap.ttl ||
      mediaType === suffixMediaTypeMap.trig) {
    const serializer = await import('./trig/serializer')
    serializer.serialize(data, process.stdout)
  } else {
    throw new Exception(`Unknown output type: ${type}`)
  }
}

function getUrl (urlObj, handleStream) {
  let headers = reader.getHeaders()
  let options = Object.assign({headers: headers}, urlObj)
  const mod = urlObj.protocol.startsWith('https') ? https : http
  mod.get(options, handleStream)
}
