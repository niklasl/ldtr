const RDFNS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const XMLNS = 'http://www.w3.org/XML/1998/namespace'
const XMLNSNS = 'http://www.w3.org/2000/xmlns/'
const XSDNS = 'http://www.w3.org/2001/XMLSchema#'

import {
  BASE,
  CONTAINER,
  CONTEXT,
  GRAPH,
  ID,
  INDEX,
  LANGUAGE as LANG,
  LIST,
  REVERSE,
  SET,
  TYPE,
  VALUE,
  VOCAB,
} from '../jsonld/keywords.js'

const ANNOTATION = '@annotation'

export function serialize(data, outstream) {
  const ser = new RDFXMLSerializer(new XMLWriter(outstream, true))
  ser.serialize(data)
}

export class RDFXMLSerializer {

  constructor (builder) {
    this.builder = builder
  }

  serialize (data) {
    this.context = data[CONTEXT]
    this.builder.openElement('rdf:RDF', this.contextAttrs(this.context))

    let nodes = data
    if (!Array.isArray(data)) {
      nodes = data[GRAPH] || data
    }
    if (!Array.isArray(nodes)) nodes = [nodes]

    for (const node of nodes) {
      this.handleNode(node)
    }
    this.builder.closeElement()
  }

  resolve (qname) {
    if (qname == TYPE) {
      return `${RDFNS}type`
    }
    let [pfx, lname] = qname.split(/:/)
    if (!lname) {
      lname = pfx
      pfx = VOCAB
    }
    return this.context[pfx] + lname
  }

  contextAttrs (context) {
    if (typeof context !== 'object') return {}

    let attrs = {}

    let rdfpfx = null

    for (let key in context) {
      let value = context[key]
      if (typeof value === 'string') {
        if (key === BASE) {
            attrs['xml:base'] = value
        } else {
          if (key === VOCAB) {
            attrs['xmlns'] = value
          } else {
            attrs[`xmlns:${key}`] = value
          }
        }
        if (value === RDFNS) {
          rdfpfx = key
        }
      }
    }

    if (rdfpfx !== 'rdf') {
      if (rdfpfx != null) {
        // TODO: switch to this prefix...
      } /* else if (rdfns != RDFNS) {
        new Error(`Cannot handle rdf prefix for non-RDF namespace: .`)
      } */
      attrs['xmlns:rdf'] = RDFNS
    }

    return attrs
  }

  handleNode (node, kind) {
    const graph = node[GRAPH]
    let id = node[ID]

    let types = node[TYPE]
    if (!types) types = []
    if (!Array.isArray(types)) types = [types]

    let firstType = types[0]
    let typeannot = null
    if (typeof firstType === 'object') {
      typeannot = firstType
      firstType = firstType[TYPE] // TODO: non-std
    }

    // FIXME: nested RDF with about is non-standard!
    // RDF/XML doesn't support named graphs at all!
    const tag = firstType ? firstType : graph ? 'rdf:RDF' : 'rdf:Description'

    if (id != null && typeof id === 'object') {
      id = this.handleQuotedTriple(id)
    }

    const aboutattr = id != null ? (
      id.startsWith('_:') ? {'rdf:ID': id.substring(2)} : {'rdf:about': id}
    ) : {}

    this.builder.openElement(tag, aboutattr)
    if (typeannot) this.handleAnnotation(typeannot)

    this.handleType(types.slice(1))

    this.handleContents(node)

    if (graph) {
      if (Array.isArray(graph)) {
        for (const it of graph) {
          this.handleNode(it)
        }
      }
    }

    this.handleAnnotation(node)

    let revs = node[REVERSE]
    if (revs) {
      this.handleReverses(revs)
    }

    this.builder.closeElement()
  }

  handleType (types) {
    for (let type of types) {
      let v = typeof type === 'object' ? type[TYPE] : type
      this.builder.addElement('rdf:type',  {'rdf:resource': this.resolve(v)})
      this.handleAnnotation(type)
    }
  }

  handleContents (node, inArray) {
    if (inArray) {
      node = {[inArray]: node}
    }

    for (const key in node) {
      if (key[0] === '@')
        continue

      const value = node[key]

      if (this.isLiteral(value)) {
        this.handleLiteral(key, value)
      } else if (Array.isArray(value)) {
        for (const part of value) {
          this.handleContents(part, key)
        }
      } else if (typeof value === 'object') {
        if (value[LIST]) {
          this.builder.openElement(key, {'rdf:parseType': "Collection"})
          for (const part of value[LIST]) {
            this.handleContents(part, 'rdf:Description') // TODO: hack
          }
          this.handleAnnotation(value)
          this.builder.closeElement()
        } else if (value[ID]) {
          this.handleRef(key, value)
        } else {
          if (key) this.builder.openElement(key)
          this.handleNode(value, 'embedded')
          if (key) this.builder.closeElement()
        }
      }
    }
  }

  isLiteral (value) {
    if (typeof value === 'object' && VALUE in value) return true
    return typeof value === 'string' || typeof value === 'number' ||
          typeof value === 'boolean'
  }

  handleLiteral (key, value) {
    let literal = null
    let dt = null
    let lang = null
    if (typeof value === 'object' && VALUE in value) {
      lang = value[LANG]
      dt = value[TYPE]
      literal = value[VALUE]
    } else {
      literal = value
    }
    let attrs = {}
    if (lang) attrs['xml:lang'] =lang
    if (dt) attrs['xml:datatype'] = this.resolve(dt)

    if (key === 'rdf:Description') { // TODO: hack
      // TODO: actually:
      // throw new Error('Regular lists of literals are not representable in RDF/XML.')
      this.builder.openElement(key)
      this.builder.addElement('rdf:value', attrs, literal)
      this.builder.closeElement()
    } else {
      this.builder.addElement(key, attrs, literal)
    }
    this.handleAnnotation(value)
  }

  handleRef (key, node) {
    let id = node[ID]
    if (typeof id === 'object') {
        this.builder.openElement(key)
      const genid = this.handleQuotedTriple(id)
      this.builder.closeElement()
      id = genid
    } else {
      if (key === 'rdf:Description') { // TODO: hack
        this.builder.addElement(key, {'rdf:about': id})
      } else {
        this.builder.addElement(key, {'rdf:resource': id})
      }
    }
    this.handleAnnotation(node)
  }

  handleReverses (revs) {
    // TODO: RDF/XML has no @reverse syntax; flatten input prior to serialization!
    /*
    this.builder.writeln('<!-- @reverse:')
    for (let link in revs) {
      this.builder.writeln(`<reverse-"${link}">`)
      for (let part of revs[link]) {
        this.handleContents(part, true)
      }
      this.builder.writeln(`</reverse-${link}>`)
    }
    this.builder.writeln('-->')
    */
  }

  handleAnnotation (node) {
    // TODO: RDF/XML has no RDF-star annotation support!
    /*
    let annot = node[ANNOTATION]
    if (annot) {
      this.builder.writeln('<!--@annotation:')
      this.handleContents(annot)
      this.builder.writeln('-->')
    }
    */
  }

  handleQuotedTriple (idNode) {
    const genid = `triple-${escape(JSON.stringify(idNode))}`
    this.builder.openElement('rdf:Statement', {'rdf:ID': genid})
    this.builder.addElement('rdf:subject', {'rdf:resource': idNode[ID]})
    for (const k in idNode) {
      if (k !== ID) {
        this.builder.addElement('rdf:predicate', {'rdf:resource': this.resolve(k)})
        this.handleContents({'rdf:object': idNode[k]})
        break
      }
    }
    this.builder.closeElement()
    return `_:${genid}`
  }

}

class XMLWriter {

  constructor (outstream, indent = false) {
    this.outstream = outstream
    this.indent = indent
    this.stack = []
  }

  addElement (tag, attrs = {}, literal = null) {
    this.iwrite(`<${tag}`)
    this.addAttrs(attrs)
    if (literal != null) {
      this.write('>')
      this.write(esc(literal))
      this.write(`</${tag}>\n`)
    } else {
      this.write('/>\n')
    }
  }

  openElement (tag, attrs = {}) {
    this.iwrite(`<${tag}`)
    this.addAttrs(attrs)
    this.write('>\n')
    this.stack.push(tag)
  }

  addAttrs (attrs) {
    for (const name in attrs) {
      this.write(` ${name}="${esc(attrs[name]).replace('"', '&quot;')}"`)
    }
  }

  closeElement () {
    const tag = this.stack.pop()
    this.iwrite(`</${tag}>\n`)
  }

  iwrite (s) {
    if (this.indent) {
      for (let i=0; i < this.stack.length; ++i) {
        this.write('  ')
      }
    }
    this.write(s)
  }

  write (s) {
    this.outstream.write(s)
  }

}

function esc (s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
}
