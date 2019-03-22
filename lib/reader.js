import fs from 'fs'
import url from 'url'
import http from 'http'
import https from 'https'
import { guessMediaType }  from './mediatypes.js'

export async function readSource(opts, headers) {
  let urlObj = opts.source ? url.parse(opts.source) : null
  let stream
  if (urlObj && urlObj.protocol != null) {
    stream = await getUrl(urlObj, headers)
  } else {
    stream = (!opts.source || opts.source === '-')
      ? process.stdin
      : fs.createReadStream(opts.source)
  }
  return await readStream(stream, opts, headers)
}

async function getUrl (urlObj, headers) {
  let options = Object.assign({headers}, urlObj)
  const mod = urlObj.protocol.startsWith('https') ? https : http
  return new Promise((resolve, reject) => {
    mod.get(options, stream => resolve(stream), reject)
  })
}

async function readStream (stream, opts, headers, redirects = 0) {
  if (redirects > opts.maxRedirects) {
    throw new Error(`Reached maximum redirect limit: ${opts.maxRedirects}`)
  }

  let { type = null, encoding = 'utf-8' } = opts

  if (String(stream.statusCode).match(/^30[123578]$/)) {
    let location = stream.headers['location']
    // `Following ${stream.statusCode} redirect to ${location}
    if (opts.verbose) {
      console.error(`# Following ${stream.statusCode} to: ${location}`)
    }
    let nextStream = await getUrl(url.parse(location), headers)
    return readStream(nextStream, opts, headers, redirects + 1)
  }

  let mediaType = type
  if (stream.headers != null) {
    let ctype = stream.headers['content-type']
    let match = ctype.match(/([^;]+)(?:\s*;\s*charset=([^,;]+))?/)
    mediaType = mediaType || match[1]
    encoding = encoding || match[2]
  } else {
    mediaType = mediaType || guessMediaType(opts.source)
  }

  return new Promise((resolve, reject) => {
    let bufs = []
    stream.on('data', d => { bufs.push(d) })
    stream.on('end', async () => {
      let buf = Buffer.concat(bufs)
      let data
      try {
        try {
          // Two problems may occur: unknown or wrong encoding
          data = buf.toString(encoding)
        } catch (e) {
          data = buf.toString('utf-8')
        }
      } catch (e) {
        reject(new Error(e))
      }
      resolve({ data, type: mediaType })
    })
  })
}
