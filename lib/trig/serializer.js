import {
  CONTEXT, GRAPH, ID, TYPE, VALUE, LANGUAGE, LIST, VOCAB, BASE, REVERSE
} from '../jsonld/keywords.js'

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
      id: "@id",
      value: '@value',
      type: '@type',
      lang: '@language',
      graph: '@graph',
      list: '@list',
      reverse: '@reverse'
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
    this.prelude()
    let graph = Array.isArray(data) ? data : data[GRAPH]
    if (graph) {
      for (let node of asArray(graph)) {
        this.objectToTurtle(node)
      }
    } else {
      this.objectToTurtle(data)
    }
  }

  prelude () {
    for (let k in this.prefixes) {
      let v = this.prefixes[k]
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
    if (this.graphKeyword) {
        this.write(`${this.graphKeyword} `)
    }
    this.writeln(`${this.refRepr(iri)} {`)
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

    let explicitList = obj[LIST]

    if (this.isListContainer(viaKey)) {
      obj = { [this.keys.list]: obj }
    }

    let s = obj[this.keys.id]

    let isList = obj[LIST]
    let startedList = isList

    if (obj[this.keys.graph]) {
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
      if (!isList) {
        depth++
        this.write("[")
      }
    } else {
      if (obj[this.keys.graph]) {
        /* TODO:
        for (let key in obj) {
          if (key[0] != '@') {
            // TODO: this is the default graph, described...
            this.write('[]')
            break
          }
        }
        */
      } else {
        return []
      }
    }

    let indent = this.getIndent(depth + inGraph)

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

      vs = Array.isArray(vs) ? vs : vs != null ? [vs] : []
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

        if (term == "@type") {
          term = "a"
          this.write(useIndent + term + " " + vs.map(it =>
            this.toValidTerm(this.termFor(it))
          ).join(", "))
          continue
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
                this.write(this.getIndent(depth + 1 + inGraph))
              } else {
                this.write(' , ')
              }
            }
          if (this.bnodeSkolemBase && typeof v === 'object' && !v[this.keys.id]) {
            v[this.keys.id] = s = this.genSkolemId()
          }
          if (typeof v === 'object' && this.keys.id in v) {
            topObjects.push(v)
            this.write(this.refRepr(v[this.keys.id]))
          } else {
            for (let it of this.objectToTurtle(v, depth + 1, key)) {
              topObjects.push(it)
            }
          }
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
        this.objectToTurtle(it)
      }
      return []
    } else {
      indent = this.getIndent(depth - 1 + inGraph)
      if (this.settings.bracketEndNewLine) {
        this.writeln()
        this.write(indent)
      } else {
        this.write(' ')
      }
      if (!isList) {
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

  toLiteral (obj, viaKey=null) {
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
          if (next) this.write(' , ')
          else next = true
          this.write(typeof v === 'string'
            ? this.refRepr(v, true)
            : v)
        }
        return
      } else if (coerceTo == "@id") {
        let next = false
        for (let v of asArray(value)) {
          if (next) this.write(' , ')
          else next = true
          this.write(this.refRepr(v))
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
      if (next) this.write(' , ')
      else next = true

      if (typeof v === 'string') {
        let escaped = v.replace(/"/g, '\\"')
        let quote = '"'
        if (escaped.indexOf('\n') > -1) {
          quote = '"""'
        }
        this.write(quote)
        this.write(escaped)
        this.write(quote)
        if (datatype)
          this.write("^^" + this.toValidTerm(this.termFor(datatype)))
        else if (lang)
          this.write("@" + lang)
      } else { // boolean or number
        this.write(v.toString())
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

  refRepr (ref, useVocab = false) {
    if (ref == null) return '[]'

    let cI = ref.indexOf(":")
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
        return ref
      }
    } else if (useVocab && ref.indexOf("/") == -1) {
      return ":" + ref
    }

    if (ref.startsWith(this.context[VOCAB])) {
      return ":" + ref.substring(this.context[VOCAB].length)
    }

    ref = this.cleanValue(ref)

    return `<${ref}>`
  }

  toValidTerm (term) {
    term = this.cleanValue(term)
    if (//term.indexOf('://') > -1 ||
        term.indexOf('/') > -1 ||
        term.indexOf('#') > -1) {
      return `<${term}>`
    }
    // TODO: hack to pseudo-fix problematic pnames...
    return term
  }

  hasKeys (obj, atLeast = 1) {
    let seen = 0
    for (let k in obj) if (++seen === atLeast) return true
    return false
  }

  cleanValue (v) {
    return v
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
