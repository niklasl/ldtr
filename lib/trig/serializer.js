import {
  CONTEXT, GRAPH, ID, TYPE, VALUE, LANGUAGE, LIST, VOCAB, BASE, REVERSE, INDEX
} from '../jsonld/keywords.js'

import { ANNOTATION, ANNOTATED_TYPE_KEY } from '../jsonld/star.js'

export function serialize (data, out = process.stdout, {
  context = null,
  baseIri = null,
  settings = {
    indentChars: '  ',
    upcaseKeywords: false,
    useGraphKeyword: true,
    spaceBeforeSemicolon: true,
    predicateRepeatNewLine: true,
    bracketStartNewLine: false,
    bracketEndNewLine: false,
    listItemNewLine: true,
    prologueEndLine: 1,
    separatorLines: 1
  }
} = {}) {
  let state = new SerializerState(context, out, settings)
  state.serialize(data)
}

class SerializerState {
  constructor (context, outstream, settings, parent = null) {
    this.outstream = outstream || parent.outstream
    this.initContext(context)
    this.parent = parent
    this.settings = parent ? parent.settings : settings
    let kw = it => this.settings.upcaseKeywords ? it.toUpperCase() : it
    this.prefixKeyword = kw('prefix')
    this.baseKeyword = kw('base')
    if (this.settings.useGraphKeyword) {
      this.graphKeyword = kw('graph')
    }
    this.uniqueBNodeSuffix = ''
    this.bnodeCounter = 0
  }

  initContext (context) {
    this.keys = {
      id: ID,
      value: VALUE,
      type: TYPE,
      lang: LANGUAGE,
      graph: GRAPH,
      list: LIST,
      reverse: REVERSE,
      index: INDEX,
      annotation: ANNOTATION
    }
    this.prefixes = {}

    if (context == null) {
      this.context = {}
    }
    else {
      for (let key in this.context) {
        throw 'context already initialized'
      }
    }
    let ctx = {}
    // TODO: merge arrays, deref uri:s ...
    if (Array.isArray(context)) {
      for (let item of context) {
        Object.assign(ctx, item)
      }
    } else if (typeof context === 'object') {
        Object.assign(ctx, context)
    }
    this.context = ctx
    this.prefixes = collectPrefixes(context)
  }

  serialize (data) {
    if (data[CONTEXT]) {
      this.initContext(data[CONTEXT])
    }
    this.prelude(this.prefixes)
    let graph = Array.isArray(data) ? data : data[GRAPH]
    if (graph) {
      for (let node of asArray(graph)) {
        this.objectToTurtle(node)
      }
    } else {
      this.objectToTurtle(data)
    }
  }

  prelude (prefixes) {
    for (let k in prefixes) {
      let v = prefixes[k]
      if (k === BASE) {
        this.writeBase(v)
      } else {
        this.writeln(`${this.prefixKeyword} ${k}: <${v}>`)
      }
    }
    if (this.base) {
      this.writeBase(this.base)
    }
    if (this.settings.prologueEndLine > 1) {
      this.writeln()
    }
  }

  writeBase (iri) {
    this.writeln(`${this.baseKeyword} <${iri}>`)
  }

  isListContainer (term) {
    if (this.context == null) return false
    return typeof this.context[term] === 'object' &&
      this.context[term]['@container'] == '@list'
  }

  isLangContainer (term) {
    if (this.context == null) return false
    return typeof this.context[term] === 'object' &&
      this.context[term]['@container'] == '@language'
  }

  objectToTrig (iri, graph) {
    this.writeln()
    if (iri == null) {
      this.writeln("{")
    } else {
      if (this.graphKeyword) {
          this.write(`${this.graphKeyword} `)
      }
      this.writeln(`${this.refRepr(iri)} {`)
    }
    for (let node of asArray(graph)) {
      this.objectToTurtle(node, 0, GRAPH)
    }
    this.writeln()
    this.writeln("}")
  }

  objectToTurtle (obj, depth = 0, viaKey = null) {
    if (depth > 0 && obj[CONTEXT]) {
      // TODO: use new SerializerState(node[CONTEXT], null, null, state)
      throw 'Nested context not supported yet'
    }

    if (this.isLangContainer(viaKey) && typeof obj === 'object') {
      let first = true
      for (let lang in obj) {
        let value = obj[lang]
          if (!first) this.write(' , ')
        this.toLiteral(
          { [this.keys.value]: value, [this.keys.lang]: lang },
          viaKey)
        first = false
      }
      return []
    }

    if (!(typeof obj === 'object') || obj[this.keys.value]) {
      this.toLiteral(obj, viaKey)
      return []
    }

    let explicitList = obj[this.keys.list]

    if (this.isListContainer(viaKey)) {
      obj = { [this.keys.list]: obj }
    }

    let s = obj[this.keys.id]

    let isList = this.keys.list in obj
    let startedList = isList

    let isBracketed = isList || viaKey === this.keys.annotation

    if (obj[this.keys.graph]) {
      if (obj[CONTEXT]) {
        this.prelude(collectPrefixes(obj[CONTEXT]))
      }
      this.objectToTrig(s, obj[this.keys.graph])
      return []
    }

    if (explicitList) {
      this.write('( ')
    }

    let inGraph = viaKey === GRAPH ? 1 : 0

    if (s != null && this.hasKeys(obj, 2)) {
      if (depth === 0) {
        this.writeln()
      }
      if (inGraph) this.write(this.getIndent(0))
      this.write(this.refRepr(s))
    } else if (depth > 0) {
      if (!isBracketed) {
        depth++
        this.write("[")
      }
    } else {
      return []
    }

    let indent = this.getIndent(depth + inGraph)

    let nestedDepth = depth + 1 + inGraph

    let topObjects = []

    let first = true
    let endedList = false

    for (let key in obj) {
      let vs = obj[key]
      let term = this.termFor(key)

      let revKey = (term == null) ? this.revKeyFor(key) : null
      if (term == null && revKey == null)
        continue

      if (term == this.keys.id || term == "@context")
        continue

      if (term == this.keys.index) {
        continue
      }

      if (term == this.keys.annotation) {
        continue
      }

      vs = Array.isArray(vs) ? vs : vs != null ? [vs] : []
      vs = vs.filter(it => it != null)

      if (!vs.length) // TODO: && not @list
        continue

      let inList = isList || this.isListContainer(key)

      let revContainer = null
      if (term === this.keys.reverse) {
        revContainer = obj[key]
      } else if (revKey) {
        revContainer = { [revKey]: obj[key] }
      }

      if (revContainer) {
        for (let revKey in revContainer) {
          let vs = revContainer[revKey]
          vs = Array.isArray(vs) ? vs : vs != null ? [vs] : []
          for (let it of vs) {
            let node = this.makeTopObject(s, revKey, it)
            topObjects.push(node)
          }
        }
      } else {
        let useIndent = indent
        if (first) {
          useIndent = ' '
          first = false
        } else {
          if (startedList && !inList && !endedList) {
            endedList = true
            this.write(" )")
          }
          this.writeln(" ;")
        }

        if (term == this.keys.type) {
          term = "a"
        }

        if (term != '@list') {
          term = this.toValidTerm(term)
          this.write(useIndent + term + " ")
        }

        for (let i = 0; i < vs.length; i++) {
          let v = vs[i]

          if (inList) {
            if (!startedList) {
              this.write("(")
              startedList = true
            }
            this.write(" ")
          } else if (i > 0) {
            if (this.settings.predicateRepeatNewLine) {
              this.writeln(' ,')
              this.write(this.getIndent(nestedDepth))
            } else {
              this.write(' , ')
            }
          }

          if (this.bnodeSkolemBase && typeof v === 'object' && !v[this.keys.id]) {
            v[this.keys.id] = s = this.genSkolemId()
          }

          if (term == "a") {
            let t = this.reprType(v)
            this.write(t)
          } else if (v && typeof v === 'object' && this.keys.id in v) {
            topObjects.push(v)
            this.write(this.refRepr(v[this.keys.id]))
          } else if (v != null) {
            for (let it of this.objectToTurtle(v, nestedDepth, key)) {
              topObjects.push(it)
            }
          }

          this.outputAnnotation(v, depth)
        }
      }
    }

    if (explicitList || (!isList && startedList) && !endedList) {
      this.write(" )")
    }

    if (depth == 0) {
      if (!first) {
        this.writeln(" .")
      }
      //this.writeln()
      for (let it of topObjects) {
        this.objectToTurtle(it, depth, viaKey)
      }
      return []
    } else {
      indent = this.getIndent(nestedDepth - (1 + inGraph))
      if (this.settings.bracketEndNewLine) {
        this.writeln()
        this.write(indent)
      } else {
        this.write(' ')
      }
      if (!isBracketed) {
        // NOTE: hack for e.g. BlazeGraph
        if (!this.hasKeys(obj) && this.settings.markEmptyBnode) {
          this.writeln(`a ${this.settings.emptyMarker}`)
          this.write(indent)
        }
        this.write("]")
      }
      return topObjects
    }
  }

  outputAnnotation (v, depth) {
    let annotation = v[this.keys.annotation]
    if (annotation != null) {
      this.write(' {|')
      this.objectToTurtle(annotation, depth + 2, this.keys.annotation)
      this.write('|}')
    }
  }

  toLiteral (obj, viaKey=null, write=(s => this.write(s))) {
    let value = obj
    let lang = this.context["@language"]
    let datatype = null
    if (typeof obj === 'object') {
      value = obj[this.keys.value]
      datatype = obj[this.keys.type]
      lang = obj[this.keys.lang]
    } else {
      let kdef = this.context[viaKey]
      let coerceTo = (typeof kdef === 'object')? kdef["@type"] : null
      if (coerceTo == "@vocab") {
        let next = false
        for (let v of asArray(value)) {
          if (next) write(' , ')
          else next = true
          write(typeof v === 'string'
            ? this.refRepr(v, true)
            : v)
        }
        return
      } else if (coerceTo == "@id") {
        let next = false
        for (let v of asArray(value)) {
          if (next) write(' , ')
          else next = true
          write(this.refRepr(v))
        }
        return
      } else if (coerceTo) {
        datatype = coerceTo
      } else {
        let termLang = (typeof kdef === 'object')? kdef["@language"] : null
        if (typeof kdef === 'object') {
          lang = termLang
        }
      }
    }

    let next = false
    for (let v of asArray(value)) {
      if (next) write(' , ')
      else next = true

      if (typeof v === 'string') {
        let escaped = v.replace(/\\/g, '\\\\')
        let quote = '"'
        if (escaped.indexOf('\n') > -1) {
          quote = '"""'
          if (escaped.endsWith('"')) {
            escaped = `${escaped.substring(0, escaped.length - 1)}\\"`
          }
        } else {
          escaped = escaped.replace(/"/g, '\\"')
        }
        write(quote)
        write(escaped)
        write(quote)
        if (datatype)
          write("^^" + this.toValidTerm(this.termFor(datatype)))
        else if (lang)
          write("@" + lang)
      } else { // boolean or number
        write(v.toString())
      }
    }
  }

  termFor (key) {
    if (key.startsWith("@")) {
      return key
    } else if (key.indexOf(":") > -1 ||
               key.indexOf('/') > -1 ||
               key.indexOf('#') > -1) {
      return key
    } else if (this.context[key]) {
      let kdef = this.context[key]
      if (kdef == null)
        return null
      let term = null
      if (typeof kdef === 'object') {
        term = kdef["@id"] || key
      } else {
        term = kdef
      }
      if (term == null)
        return null
      return (term.indexOf(":") == -1)? ":" + term : term
    } else {
      return ":" + key
    }
  }

  revKeyFor (key) {
    let kdef = this.context[key]
    if (!(typeof kdef === 'object'))
      return null
    return kdef["@reverse"]
  }

  makeTopObject (s, revKey, it) {
    let node = Object.assign({}, it)
    // TODO: probe object to find an id:d top object...
    if (node[this.keys.id] == null) {
      node[this.keys.id] = `_:bnode-${this.bnodeCounter++}`
    }
    node[revKey] = { [this.keys.id]: s }
    return node
  }

  reprType (t) {
    t = typeof t === 'string' ? t : t[ANNOTATED_TYPE_KEY]
    return this.toValidTerm(this.termFor(t))
  }

  refRepr (ref, useVocab = false) {
    if (ref == null) return '[]'

    if (typeof ref === 'object' && this.keys.id in ref) {
      return this.reprTriple(ref)
    }

    let cI = ref.indexOf(':')
    if (cI > -1) {
      let pfx = ref.substring(0, cI)
      if (pfx == "_") {
        let nodeId = ref + this.uniqueBNodeSuffix
        if (this.bnodeSkolemBase) {
          ref = this.bnodeSkolemBase + nodeId.substring(2)
        } else {
          return this.toValidTerm(nodeId)
        }
      } else if (this.context[pfx]) {
        let local = ref.substring(cI + 1)
        return `${pfx}:${this.escapePNameLocal(local)}`
      }
    } else if (useVocab && ref.indexOf("/") == -1) {
      return ":" + ref
    }

    if (ref.startsWith(this.context[VOCAB])) {
      return ":" + ref.substring(this.context[VOCAB].length)
    }

    ref = this.cleanValue(ref)

    if (ref.indexOf(':') > -1) {
      let [pfx, ...rest] = ref.split(/:/)
      if (pfx in this.context) {
        return ref
      }
      // non-std: check if ref is "most likely" a pname
      if (Object.keys(this.context).length > 0 &&
          rest.length == 1 &&
          rest[0].match(/^\w*$/) && pfx.match(/^\w*$/)) {
        return ref
      }
    }

    return `<${ref}>`
  }

  reprTriple(ref) {
    let s = this.refRepr(ref[this.keys.id])

    let p = null
    let obj = null
    for (let k in ref) {
      if (k === this.keys.id) {
        continue
      }
      if (p != null) {
        throw 'Quoted triples cannot contain multiple statements'
      }
      p = this.termFor(k)
      obj = ref[k]
    }

    let o
    if (p == this.keys.type) {
      p = "a"
      o = this.reprType(obj)
    } else {
      if (Array.isArray(obj)) {
        throw 'Quoted triples must have one single object'
      }
      if (this.isLangContainer(p) && typeof obj === 'object') {
        throw 'Language containers not yet supported in quoted triples'
      }
      if (typeof obj === 'object' && this.keys.list in obj) {
        throw 'Quoted triples cannot contain Lists'
      }

      if (!(typeof obj === 'object') || obj[this.keys.value]) {
        let l = []
        this.toLiteral(obj, p, s => l.push(s))
        o = l.join('')
      } else {
        o = this.refRepr(obj)
      }
    }

    return `<< ${s} ${p} ${o} >>`
  }

  toValidTerm (term) {
    term = this.cleanValue(term)
    let cI = term.indexOf(':')
    let pfx = cI > -1 ? term.substring(0, cI) : null
    if (!(pfx in this.context) &&
        // non-std: fake pnames even when missing prefixes!
        (term.indexOf('/') > -1 ||
         term.indexOf('#') > -1 ||
         pfx !== null && term.lastIndexOf(':') > pfx.length)) {
      return `<${term}>`
    }
    if (pfx !== null) {
      let local = term.substring(cI + 1)
      return `${pfx}:${this.escapePNameLocal(local)}`
    }
    return this.escapePNameLocal(term)
  }

  hasKeys (obj, atLeast = 1) {
    let seen = 0
    for (let k in obj)
      if (k !== this.keys.annotation)
        if (++seen === atLeast)
          return true
    return false
  }

  cleanValue (v) {
    return v
  }

  escapePNameLocal (pnlocal) {
    // From: https://www.w3.org/TR/turtle/#grammar-production-PN_LOCAL_ESC
    // Note that '.-' are OK within, but need escaping at start/end.
    // And '_' *may* be escaped but is OK everywhere in PN_LOCAL.
    return pnlocal.replace(/([~!$&'()*+,;=/?#@%]|^[.-]|[.-]$)/g, '\\$1')
  }

  genSkolemId () {
    return this.bnodeSkolemBase + UUID.randomUUID()
  }

  getIndent (depth) {
    let chunks = []
    for (let i = -1; i++ < depth;) {
      chunks.push(this.settings.indentChars)
    }
    return chunks.join('')
  }

  write (s) {
    this.outstream.write(s || '')
  }

  writeln (s) {
    this.outstream.write((s || '') + '\n')
  }
}

function collectPrefixes (context) {
  if (typeof context !== 'object') return

  let prefixes = {}
  for (let key in context) {
    let value = context[key]
    // TODO: verify JSON-LD 1.1 prefix rules
    if (typeof value === 'string' && value.match(/[#\/:]$/)) {
      prefixes[key === VOCAB ? '' : key] = value
    } else if (value && value['@prefix'] === true) {
      prefixes[key] = value[ID]
    }
  }
  return prefixes
}

function asArray(value) {
  return Array.isArray(value) ? value : [value]
}
