// NOTE: this file is based on transpiled JS from <https://github.com/niklasl/trld>.
'use strict'

import { BASE, CONTEXT, GRAPH, ID, INDEX, LANGUAGE, LIST, TYPE, VALUE, VOCAB } from '../jsonld/keywords.js'
import { ANNOTATION, ANNOTATED_TYPE_KEY } from '../jsonld/star.js'
import { RDFNS, RDFGNS, XMLNS, XMLNSNS } from './terms.js'
import { XmlAttribute, XmlElement, XmlReader } from './xmlcompat.js'

export class RdfAttrs {

  constructor (attributes) {
    this.ns = {}
    this.values = {}
    this.base = null
    this.lang = null
    this.about = null
    this.rdfId = null
    this.nodeID = null
    this.resource = null
    this.datatype = null
    this.parseType = null
    for (let attr of attributes) {
      let nsUri = attr.namespaceURI
      let lname = attr.localName
      let value = attr.value
      if (nsUri == XMLNSNS) {
        let pfx = lname
        if (pfx == "xmlns") {
          pfx = VOCAB
        }
        this.ns[pfx] = value
      } else if (nsUri == XMLNS) {
        if (lname == "lang") {
          this.lang = value
        } else if (lname == "base") {
          this.base = value
        }
      } else if (nsUri == RDFNS) {
        if (lname == "about") {
          this.about = value
        } else if (lname == "ID") {
          this.rdfId = "#" + value
        } else if (lname == "nodeID") {
          this.nodeID = value
        } else if (lname == "resource") {
          this.resource = value
        } else if (lname == "datatype") {
          this.datatype = value
        } else if (lname == "parseType") {
          this.parseType = value
        } else {
          throw new Error("Unknown RDF attribute: " + attr.name + "=\"" + value + "\"")
        }
      } else {
        this.values[attr.name] = value
      }
    }
  }
}

export function parse (source) {
  let reader = new XmlReader()
  let root = reader.getRoot(source)
  let context = {}
  let graph = []
  let result = {[CONTEXT]: context, [GRAPH]: graph}
  let annots = []
  walk(root, result, null, annots)
  _inlineAnnotations(result, annots)
  return result
}

export function walk (elem, result, node, annots) {
  let attrs = new RdfAttrs(elem.getAttributes())
  let ctx = result[CONTEXT]
  if (attrs.ns != null) {
    Object.assign(ctx, attrs.ns)
  }
  if (attrs.base != null) {
    ctx[BASE] = attrs.base
  }
  if (node == null) {
    if (attrs.lang != null) {
      ctx[LANGUAGE] = attrs.lang
    }
  }
  let childNode = null
  let consumed = false
  let value = null
  let props = null
  if ((elem.namespaceURI == RDFNS && elem.localName == "RDF")) {
    childNode = node
  } else if (node == null) {
    node = {}
    result[GRAPH].push(node)
    if ((elem.namespaceURI != RDFNS || elem.localName != "Description")) {
      node[TYPE] = elem.tagName
    }
    if (attrs.about != null) {
      node[ID] = attrs.about
    } else if (attrs.rdfId != null) {
      node[ID] = attrs.rdfId
    } else if (attrs.nodeID != null) {
      node[ID] = "_:" + attrs.nodeID
    }
    childNode = node
    Object.assign(node, attrs.values)
  } else {
    if (attrs.parseType == "Resource") {
      childNode = {}
      value = childNode
    } else if (attrs.parseType == "Collection") {
      let coll = []
      value = {[LIST]: coll}
      result = {[CONTEXT]: {}, [GRAPH]: coll}
    } else if (attrs.parseType == "Literal") {
      let xml = elem.getInnerXml()
      value = {[TYPE]: "rdf:XMLLiteral", [VALUE]: xml}
      consumed = true
    } else if (attrs.resource != null) {
      value = {[ID]: attrs.resource}
    } else if (attrs.nodeID != null) {
      value = {[ID]: "_:" + attrs.nodeID}
    } else if (elem.getChildElements().length) {
      value = []
      result = {[CONTEXT]: {}, [GRAPH]: value}
    } else {
      value = elem.getText()
      if (attrs.lang != null) {
        value = {[VALUE]: value, [LANGUAGE]: attrs.lang}
      } else if (attrs.datatype != null) {
        value = {[VALUE]: value, [TYPE]: attrs.datatype}
      }
    }
    if (attrs.rdfId != null) {
      if (!(value !== null && typeof value === 'object' && !Array.isArray(value))) {
        value = {[VALUE]: value}
      }
      let annot = {[ID]: attrs.rdfId}
      value[ANNOTATION] = annot
      annots.push(annot)
    }
    let key
    if ((elem.namespaceURI == RDFNS && elem.localName == "type")) {
      key = TYPE
      // assert value !== null && typeof value === 'object' && !Array.isArray(value) : null
      if (Object.hasOwnProperty.call(value, ANNOTATION)) {
        let typeid = value[ID]
        value = {[ANNOTATED_TYPE_KEY]: typeid, [ANNOTATION]: value[ANNOTATION]}
      } else {
        value = value[ID]
      }
    } else if ((elem.namespaceURI == RDFGNS && elem.localName == "isGraph" && attrs.parseType == "GraphLiteral")) {
      key = GRAPH
      if (node[TYPE] == "rdfg:Graph") {
        delete node[TYPE]
      }
    } else {
      key = elem.tagName
    }
    props = node[key]
    if (props == null) {
      node[key] = value
    } else {
      if (!(Array.isArray(props))) {
        props = [props]
        node[key] = props
      }
      if (!(Array.isArray(value))) {
        props.push(value)
      } else {
      }
    }
  }
  if (consumed) {
    return
  }
  for (let child of elem.getChildElements()) {
    walk(child, result, childNode, annots)
  }
  if ((Array.isArray(props) && Array.isArray(value))) {
    Array.prototype.push.apply(props, value)
  }
}

function _inlineAnnotations (result, annots) {
  if (annots.length > 0) {
    let index = {}
    _addToIndex(index, result)
    for (let annot of annots) {
      let [desc, ownergraph] = index[annot[ID]]
      delete index[annot[ID]]
      if (desc != null) {
        Object.assign(annot, desc)
        delete annot[ID]
        ownergraph.splice(ownergraph.indexOf(desc), 1)
      }
    }
  }
}

function _addToIndex (index, graph) {
  if (!(Array.isArray(graph))) {
    graph = [graph]
  }
  for (let node of graph) {
    // assert node !== null && typeof node === 'object' && !Array.isArray(node) : null
    if (Object.hasOwnProperty.call(node, ID)) {
      index[node[ID]] = [node, graph]
    }
    if (Object.hasOwnProperty.call(node, GRAPH)) {
      _addToIndex(index, node[GRAPH])
    }
  }
}
