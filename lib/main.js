import './setup.js'
import { suffixMediaTypeMap, guessMediaType }  from './mediatypes.js'
import { readSource } from './reader.js'
import { transcribers, requestHeaders } from './transcribers.js'

const MAX_REDIRECTS = 32

export async function read (source, opts = {}) {
  if (typeof opts === 'string') {
    opts = {type: opts}
  }

  if (typeof source === 'object') {
    Object.assign(opts, source)
  } else if (typeof source === 'string') {
    opts.source = source
  } else if (source) {
    opts.data = source
  }

  let type = opts.type
  type = suffixMediaTypeMap[type] || type
  opts.type = type

  if (opts.maxRedirects == null) {
    opts.maxRedirects = MAX_REDIRECTS
  }

  let headers = requestHeaders()
  if (opts.verbose) {
    console.error(`# Headers: ${JSON.stringify(headers)}`)
  }

  let input
  if (opts.data != null) {
    input = { data: opts.data, type: opts.type }
    if (input.type == null &&
      input.data.nodeType != null &&
      input.data.contentType != null) {
      input.type = input.data.contentType
    }
  } else {
    input = await readSource(opts, headers)
  }

  let transcribe = transcribers[input.type]
  if (transcribe == null && typeof opts.source === 'string') {
    transcribe = transcribers[guessMediaType(opts.source)]
  }

  return await transcribe(input)
}

export async function write (data, opts = {}) {
  let { type = null } = opts

  type = suffixMediaTypeMap[type] || type

  if (type === suffixMediaTypeMap.ttl ||
      type === suffixMediaTypeMap.trig) {
    const serializer = await import('./trig/serializer')
    serializer.serialize(data, process.stdout)
  } else if (type === suffixMediaTypeMap.rdf ||
      type === suffixMediaTypeMap.rdfs ||
      type === suffixMediaTypeMap.owl ||
      type === suffixMediaTypeMap.xml) {
    const serializer = await import('./rdfxml/serializer')
    serializer.serialize(data, process.stdout)
  } else if (type === suffixMediaTypeMap.jsonld ||
             type == null) {
    console.log(JSON.stringify(data, null, 2))
  } else {
    throw new Error(`Unknown output type: ${type}`)
  }
}
