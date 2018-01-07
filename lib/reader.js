'use(strict)'

const fs = require('fs')
const url = require('url')

function read (source, {base = null, type = null, encoding = 'utf-8'} = {}) {
  return new Promise(function (resolve, reject) {
    function handleStream (stream) {
      if (String(stream.statusCode).match(/^30[123578]$/)) {
        let location = stream.headers['location']
        // `Following ${stream.statusCode} redirect to ${location}
        getUrl(url.parse(location), handleStream)
        return
      }
      let mediaType = suffixMediaTypeMap[type] || type
      if (stream.headers != null) {
        let ctype = stream.headers['content-type']
        let match = ctype.match(/([^;]+)(?:\s*;\s*charset=([^,;]+))?/)
        mediaType = mediaType || match[1]
        encoding = encoding || match[2]
      } else {
        mediaType = mediaType || guessMediaType(source)
      }

      let transcriber = transcribers[mediaType]

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

        let result = transcriber(str, base || source, mediaType)
        resolve(result)
      })
    }

    let urlObj = source ? url.parse(source) : null
    if (urlObj && urlObj.protocol != null) {
      getUrl(urlObj, handleStream)
    } else {
      let stream =
        (!source || source === '-') ? process.stdin
        : fs.createReadStream(source)
      handleStream(stream)
    }
  })
}

function getUrl (urlObj, handleStream) {
  const module = require(urlObj.protocol.replace(/:/, ''))
  let accepts = Object.keys(transcribers).map((k, i) =>
    k + (i ? ';q=0.' + String(10 - i) : '')
  ).join(', ')

  let headers = {'accept': accepts, 'user-agent': 'LDTR'}
  let options = Object.assign({headers: headers}, urlObj)
  module.get(options, handleStream)
}

function guessMediaType (source) {
  let m = source ? source.match(/\.(\w+)$/) : null
  let suffix = m ? m[1] : 'ttl'
  return suffixMediaTypeMap[suffix]
}

var suffixMediaTypeMap = {
  'ttl': 'text/turtle',
  'trig': 'text/trig',
  'jsonld': 'application/ld+json',
  'xml': 'application/rdf+xml',
  'rdf': 'application/rdf+xml',
  'rdfs': 'application/rdf+xml',
  'owl': 'application/rdf+xml',
  'html': 'text/html'
}

var transcribers = {
  'text/trig': trigToJsonLd,
  'text/turtle': trigToJsonLd,
  'application/ld+json': JSON.parse.bind(JSON),
  'application/rdf+xml': rdfxmlToJsonLd,
  'text/html': rdfaToJsonLd
}

function trigToJsonLd (trigString) {
  const trigParser = require('./trig/parser')
  try {
    return trigParser.parse(trigString)
  } catch (e) {
    if (e.location) {
      let start = e.location.start
      console.error(e.name, 'at', 'line:', start.line, 'column:', start.column, e.message)
    } else {
      throw e
    }
  }
}

function rdfxmlToJsonLd (xmlStr) {
  const rdfxmlParser = require('./rdfxml/parser')
  let domParser = newDomParser()
  let doc = domParser.parseFromString(xmlStr, 'text/xml')
  return rdfxmlParser.parse(doc)
}

function rdfaToJsonLd (xmlStr, source, mediaType) {
  const rdfaParser = require('./rdfa/parser')
  let domParser = newDomParser()
  let doc = domParser.parseFromString(xmlStr, 'text/html')
  return rdfaParser.parse(doc, source, {compact: true})
}

function newDomParser () {
  const xmlapi = typeof window !== 'undefined' ? window : require('xmldom')
  return new xmlapi.DOMParser()
}

module.exports = {
  read,
  getUrl,
  guessMediaType,
  transcribers,
  suffixMediaTypeMap
}
