import fs from 'fs'
import url from 'url'
import http from 'http'
import https from 'https'

import './setup.js'
import * as mediatypes from './mediatypes.js'
import * as reader from './reader.js'

const MAX_REDIRECTS = 32

export async function read (source, opts = {}) {
  if (typeof source === 'object') {
    opts = source
  } else if (typeof source === 'string') {
    opts.source = source
  }

  if (opts.maxRedirects == null) {
    opts.maxRedirects = MAX_REDIRECTS
  }

  if (opts.verbose) {
    console.error(`# Headers: ${JSON.stringify(reader.getHeaders())}`)
  }

  let urlObj = opts.source ? url.parse(opts.source) : null

  if (urlObj && urlObj.protocol != null) {
    let stream = await getUrl(urlObj)
    return await readStream(stream, opts)
  }

  let stream = (!opts.source || opts.source === '-')
    ? process.stdin
    : fs.createReadStream(opts.source)

  return await readStream(stream, opts)
}

async function readStream (stream, opts, redirects = 0) {
  if (redirects > opts.maxRedirects) {
    throw new Error(`Reached maximum redirect limit: ${opts.maxRedirects}`)
  }

  let {
    base = null,
    type = null,
    encoding = 'utf-8'
  } = opts

  if (String(stream.statusCode).match(/^30[123578]$/)) {
    let location = stream.headers['location']
    // `Following ${stream.statusCode} redirect to ${location}
    if (opts.verbose) {
      console.error(`# Following ${stream.statusCode} to: ${location}`)
    }
    let nextStream = await getUrl(url.parse(location))
    return await readStream(nextStream, opts, redirects + 1)
  }

  let mediaType = mediatypes.suffixMediaTypeMap[type] || type

  if (stream.headers != null) {
    let ctype = stream.headers['content-type']
    let match = ctype.match(/([^;]+)(?:\s*;\s*charset=([^,;]+))?/)
    mediaType = mediaType || match[1]
    encoding = encoding || match[2]
  } else {
    mediaType = mediaType || mediatypes.guessMediaType(opts.source)
  }

  let transcriber = reader.transcribers[mediaType]

  let consumeStream = new Promise((resolve, reject) => {
    let bufs = []
    stream.on('data', d => { bufs.push(d) })
    stream.on('end', async () => {
      let buf = Buffer.concat(bufs)
      let str
      try {
        try {
          // Two problems may occur: unknown or wrong encoding
          str = buf.toString(encoding)
        } catch (e) {
          str = buf.toString('utf-8')
        }
      } catch (e) {
        reject(new Error(e))
      }
      resolve(str)
    })
  })

  let str = await consumeStream
  return await transcriber(str, base || opts.source, mediaType)
}

async function getUrl (urlObj) {
  let headers = reader.getHeaders()
  let options = Object.assign({headers}, urlObj)
  const mod = urlObj.protocol.startsWith('https') ? https : http
  return new Promise((resolve, reject) => {
    mod.get(options, stream => resolve(stream), reject)
  })
}

export async function write (data, opts = {}) {
  let { type = null } = opts

  const {suffixMediaTypeMap} = await import('./mediatypes')
  type = suffixMediaTypeMap[type] || type

  if (type === suffixMediaTypeMap.ttl ||
      type === suffixMediaTypeMap.trig) {
    const serializer = await import('./trig/serializer')
    serializer.serialize(data, process.stdout)
  } else if (type === suffixMediaTypeMap.jsonld ||
             type == null) {
    console.log(JSON.stringify(data, null, 2))
  } else {
    throw new Error(`Unknown output type: ${type}`)
  }
}
