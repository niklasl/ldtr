// NOTE: this file is based on transpiled JS from <https://github.com/niklasl/trld>.
'use strict'

import { createHash } from '../compat.js'

import { RDFNS, RDFGNS, XMLNS, XMLNSNS } from './terms.js'
const XSDNS = 'http://www.w3.org/2001/XMLSchema#'
const XSD_STRING = `${XSDNS}string`

import {
  BASE,
  CONTAINER,
  CONTEXT,
  GRAPH,
  ID,
  INDEX,
  LANGUAGE,
  LIST,
  REVERSE,
  SET,
  TYPE,
  VALUE,
  VOCAB,
} from '../jsonld/keywords.js'
import { BNodes } from '../util/bnodes.js'
import { ANNOTATION, ANNOTATED_TYPE_KEY } from '../jsonld/star.js'

export function serialize (data, outstream) {
  let ser = new RDFXMLSerializer(new XMLWriter(outstream, 2), data)
  ser.serialize()
}

export class RDFXMLSerializer {

  constructor (builder, data, useArcIds = true, tripleIdForm = "_") {
    this.builder = builder
    this.bnodes = new BNodes('', 1)
    this._deferreds = []
    this.context = data[CONTEXT]
    this.useArcIds = useArcIds
    this.tripleIdForm = tripleIdForm
    this.nodes = this._getNodes(data)
  }

  _getNodes (data) {
    let nodes = data
    if (!(Array.isArray(nodes))) {
      nodes = (data[GRAPH] || data != null)
    }
    if (!(Array.isArray(nodes))) {
      nodes = [nodes]
    }
    return nodes
  }

  serialize () {
    this.builder.openElement("rdf:RDF", this.contextAttrs(this.context))
    for (let node of this.nodes) {
      this.handleNode(node)
    }
    this._clearDeferred()
    this.builder.closeElement()
  }

  expand (qname) {
    return this.resolve(qname, false)
  }

  resolve (qname, asTerm = true) {
    if (qname == TYPE) {
      return RDFNS + "type"
    }
    let [_, pfx, cln, lname] = qname.split(/([^:]+)(:)(.*)/)
    if (!pfx) pfx = qname
    if ((!(lname) && asTerm)) {
      lname = pfx
      pfx = VOCAB
    }
    if (!(Object.hasOwnProperty.call(this.context, pfx))) {
      return qname
    }
    return this.context[pfx] + lname
  }

  contextAttrs (context) {
    if (!(context !== null && typeof context === 'object' && !Array.isArray(context))) {
      return {}
    }
    let attrs = {}
    let rdfpfx = null
    let gpfx = null
    for (let key of Object.keys(context)) {
      let value = context[key]
      if (typeof value === 'string') {
        if (JSON.stringify(key) === JSON.stringify(BASE)) {
          attrs["xml:base"] = value
        } else if (JSON.stringify(key) === JSON.stringify(VOCAB)) {
          attrs["xmlns"] = value
        } else {
          attrs["xmlns:" + key] = value
        }
        if (value == RDFNS) {
          let rdfpfx = key
        } else if (value == RDFGNS) {
          let gpfx = key
        }
      }
    }
    if (rdfpfx != "rdf") {
      if (rdfpfx != null) {
      }
      attrs["xmlns:rdf"] = RDFNS
    }
    if (gpfx != "rdfg") {
      attrs["xmlns:rdfg"] = RDFGNS
    }
    return attrs
  }

  handleNode (node, key = null) {
    let graph = node[GRAPH]
    let id = node[ID]
    id = id ? this.expand(id) : null
    let types = node[TYPE]
    if (!(types)) {
      let types = []
    }
    if (!(Array.isArray(types))) {
      types = [types]
    }
    let firstType = (types.length > 0 ? types[0] : null)
    let annotFirstType = false
    if (firstType !== null && typeof firstType === 'object' && !Array.isArray(firstType)) {
      annotFirstType = true
      firstType = null
    }
    let tag = (firstType ? firstType : (graph ? "rdfg:Graph" : "rdf:Description"))
    if ((id != null && id !== null && typeof id === 'object' && !Array.isArray(id))) {
      let qid = this.handleQuotedTriple(id)
      id = "_:" + qid
    }
    let aboutattr = (id != null ? (id.startsWith("_:") ? {["rdf:nodeID"]: id.substring(2)} : {["rdf:about"]: id}) : {})
    let revs = node[REVERSE]
    let hasSimpleType = (types.length < 2 && !(annotFirstType))
    if ((hasSimpleType && !(revs) && !(graph) && !(_nonspecial(node)))) {
      this.builder.addElement(tag, aboutattr)
    } else {
      this.builder.openElement(tag, aboutattr)
      this.handleType(id, (annotFirstType ? types : types.splice(1)))
      this.handleContents(node)
      if (graph) {
        this.builder.openElement("rdfg:isGraph", {["rdf:parseType"]: "GraphLiteral"})
        if (Array.isArray(graph)) {
          for (let it of graph) {
            this.handleNode(it)
          }
        }
        this.builder.closeElement()
      }
      if (revs) {
        this.handleReverses(revs)
      }
      this.builder.closeElement()
    }
    this._clearDeferred()
  }

  _clearDeferred () {
    if (!(this._deferreds)) {
      return
    }
    for (let [annot, triplenode, qid] of this._deferreds) {
      if (this.useArcIds) {
        this.builder.openElement("rdf:Description", {["rdf:ID"]: qid})
        this.handleContents(annot)
        this.builder.closeElement()
      } else {
        this.handleQuotedTriple(triplenode, annot)
      }
    }
    this._deferreds = []
  }

  handleType (id, types) {
    for (let type of types) {
      let v
      let annot = null
      if (type !== null && typeof type === 'object' && !Array.isArray(type)) {
        v = type[ANNOTATED_TYPE_KEY]
        annot = type[ANNOTATION]
      } else {
        v = type
      }
      let typeUri = this.resolve(v)
      let attrs = {["rdf:resource"]: typeUri}
      this.handleAnnotation(id, TYPE, attrs, {[ID]: typeUri, [ANNOTATION]: annot})
      this.builder.addElement("rdf:type", attrs)
    }
  }

  handleContents (node, tag = null) {
    let id = node[ID]
    for (let key of Object.keys(node)) {
      if (key.startsWith("@")) {
        continue
      }
      let value = node[key]
      if (this.isLiteral(value)) {
        this.handleLiteral(id, key, value)
      } else if (Array.isArray(value)) {
        for (let part of value) {
          let partnode = {[ID]: id, [key]: part}
          this.handleContents(partnode)
        }
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        if (value[LIST]) {
          let attrs = {["rdf:parseType"]: "Collection"}
          this.handleAnnotation(id, key, attrs, value)
          this.builder.openElement(key, attrs)
          for (let part of value[LIST]) {
            this.handleContents(part, "rdf:Description")
          }
          this.builder.closeElement()
        } else if ((!(Object.hasOwnProperty.call(value, ANNOTATION)) ? (Object.hasOwnProperty.call(value, ID) && Object.keys(value).length === 1) : 2)) {
          this.handleRef(key, value)
        } else {
          if (key != null) {
            let attrs = {}
            this.handleAnnotation(id, key, attrs, value)
            this.builder.openElement(key, attrs)
          }
          this.handleNode(value, key)
          if (key != null) {
            this.builder.closeElement()
          }
        }
      }
    }
  }

  isLiteral (value) {
    if ((value !== null && typeof value === 'object' && !Array.isArray(value) && Object.hasOwnProperty.call(value, VALUE))) {
      return true
    }
    return (typeof value === 'string' || typeof value === 'number' || typeof value === 'number' || typeof value === 'boolean')
  }

  handleLiteral (id, key, value) {
    let literal = null
    let dt = null
    let lang = null
    if ((value !== null && typeof value === 'object' && !Array.isArray(value) && Object.hasOwnProperty.call(value, VALUE))) {
      lang = value[LANGUAGE]
      dt = value[TYPE]
      literal = value[VALUE]
    } else {
      literal = value
    }
    let attrs = {}
    if (lang) {
      attrs["xml:lang"] = lang
    }
    if (dt) {
      attrs["rdf:datatype"] = this.resolve(dt)
    }
    this.handleAnnotation(id, key, attrs, value)
    if (JSON.stringify(key) === JSON.stringify("rdf:Description")) {
      this.builder.openElement(key)
      this.builder.addElement("rdf:value", attrs, literal)
      this.builder.closeElement()
    } else {
      this.builder.addElement(key, attrs, literal)
    }
  }

  handleRef (key, node) {
    let id = this.expand(node[ID])
    if (id !== null && typeof id === 'object' && !Array.isArray(id)) {
      this.builder.openElement(key)
      this.handleQuotedTriple(id)
      this.builder.closeElement()
    } else if (JSON.stringify(key) === JSON.stringify("rdf:Description")) {
      this.builder.addElement(key, {["rdf:about"]: id})
    } else {
      let attrs = {["rdf:resource"]: id}
      this.handleAnnotation(id, key, attrs, node)
      this.builder.addElement(key, attrs)
    }
  }

  handleReverses (revs) {
  }

  handleAnnotation (s, p, arcAttrs, node) {
    if (!(Object.hasOwnProperty.call(node, ANNOTATION))) {
      return
    }
    let annot = node[ANNOTATION]
    if (annot) {
      let notannot = Object.assign({}, node)
      delete notannot[ANNOTATION]
      let triplenode = {[ID]: s, [p]: notannot}
      let qid = makeQid(this, triplenode)
      if (this.useArcIds) {
        arcAttrs["rdf:ID"] = qid
      }
      this._deferreds.push([annot, triplenode, qid])
    }
  }

  handleQuotedTriple (triplenode, annot = null) {
    let qid = makeQid(this, triplenode)
    this.builder.openElement("rdf:Statement", {["rdf:ID"]: qid})
    this.builder.addElement("rdf:subject", {["rdf:resource"]: triplenode[ID]})
    for (let k of triplenode) {
      if (k != ID) {
        this.builder.addElement("rdf:predicate", {["rdf:resource"]: this.resolve(k)})
        this.handleContents({["rdf:object"]: triplenode[k]})
        break
      }
    }
    if (annot != null) {
      this.handleContents(annot)
    }
    this.builder.closeElement()
    return
  }
}

export class XMLWriter {

  constructor (outstream, indent = 0) {
    this.outstream = outstream
    if (typeof indent === 'number') {
      this.indent = " ".repeat(indent)
    } else if (typeof indent === 'string') {
      this.indent = indent
    } else {
      this.indent = ""
    }
    this.stack = []
  }

  addElement (tag, attrs = null, literal = null) {
    this.iwrite("<" + tag)
    this._addAttrs(attrs, tag)
    if (literal != null) {
      this.write(">")
      this.write(xmlescape(literal))
      this.write("</" + tag + ">\n")
    } else {
      this.write("/>\n")
    }
  }

  openElement (tag, attrs = null) {
    this.iwrite("<" + tag)
    this._addAttrs(attrs, tag)
    this.write(">\n")
    this.stack.push(tag)
  }

  _addAttrs (attrs, tag) {
    if (attrs == null) {
      return
    }
    let first = true
    for (let name of Object.keys(attrs)) {
      let entquoted = xmlescape(attrs[name]).replace("\"", "&quot;")
      let attrval = " " + name + "=\"" + entquoted + "\""
      if (first) {
        this.write(attrval)
      } else {
        this.write("\n")
        let padd = ""
        for (let i = 0; i < tag.length + 1; i++) {
          padd += " "
        }
        this.iwrite(padd + attrval)
      }
      first = false
    }
  }

  closeElement () {
    let tag = this.stack.pop()
    this.iwrite("</" + tag + ">\n")
  }

  iwrite (s) {
    if (this.indent != null) {
      for (let i = 0; i < this.stack.length; i++) {
        this.write(this.indent)
      }
    }
    this.write(s)
  }

  write (s) {
    this.outstream.write(s)
  }
}

export function xmlescape (s) {
  if (typeof s !== 'string') s = s.toString()
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
}

function _nonspecial (node) {
  return Object.keys(node).find(key => !key.startsWith('@'))
}

export function makeQid (ctx, triplenode) {
  let s = null
  let p = null
  let o = null
  for (let k in triplenode) {
    let v = triplenode[k]
    if (k == ID) {
      s = v
    } else {
      [p, o] = [k, v]
      // assert o !== null && typeof o === 'object' && !Array.isArray(o) : null
      o = Object.assign({}, o)
      if (Object.hasOwnProperty.call(o, ID)) {
        o[ID] = ctx.resolve(o[ID])
      }
      if (Object.hasOwnProperty.call(o, TYPE)) {
        o[TYPE] = ctx.resolve(o[TYPE])
      }
    }
  }
  if (s == null) {
    s = ctx.bnodes.makeBnodeId()
  }
  let orepr
  if (typeof o === 'string') {
    orepr = o
  } else if (o !== null && typeof o === 'object' && !Array.isArray(o)) {
    if (Object.hasOwnProperty.call(o, ID)) {
      orepr = o[ID]
    } else {
      orepr = o[VALUE] + " "
      let lang = o[LANGUAGE]
      let dt = o[TYPE]
      if (lang != null) {
        orepr += lang
      } else if ((dt != null && dt != XSD_STRING)) {
        orepr += dt
      }
    }
  }
  let triplerepr = s + " " + p + " " + orepr
  if (ctx.tripleIdForm == "_") {
    return "triple-" + ctx.bnodes.makeBnodeId(triplerepr).substring(2)
  } else if (ctx.tripleIdForm != null) {
    let hash = createHash(ctx.tripleIdForm)
    hash.update(triplerepr)
    let hashhex = hash.digest('hex')
    return "triple-" + hashhex
  } else {
    return "triple:" + urlescape(triplerepr)
  }
}

export function urlescape (s) {
  return escape(s).replace(/%20/g, '+')
}
