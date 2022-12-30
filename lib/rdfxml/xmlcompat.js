'use strict'

import {DOMParser, XMLSerializer} from '../compat.js'

export class XmlReader {

  constructor () {
    this._serializer = new XMLSerializer()
  }

  getRoot (source) {
    let doc
    if (typeof source === 'string') {
      doc = new DOMParser().parseFromString(source, 'text/xml')
    } else {
      doc = source
    }
    return new XmlElement(this, doc.documentElement)
  }
}

export class XmlAttribute {
  constructor(name, namespaceURI, localName, value) {
    this.name = name
    this.namespaceURI = namespaceURI
    this.localName = localName
    this.value = value
  }
}

export class XmlElement {

  constructor (reader, elem) {
    this._reader = reader
    this._elem = elem
    this.namespaceURI = elem.namespaceURI
    this.localName = elem.localName
    this.tagName = elem.tagName
  }

  getAttributes () {
    let attrs = []
    for (let i = 0; i < this._elem.attributes.length; i++) {
      let attr = this._elem.attributes.item(i)
      attrs.push(new XmlAttribute(attr.name, attr.namespaceURI, attr.localName, attr.value))
    }
    return attrs
  }

  getChildElements () {
    return Array.prototype.filter.call(this._elem.childNodes, (elem) => elem.nodeType == elem.ELEMENT_NODE).map((elem) => new XmlElement(this._reader, elem))
  }

  getText () {
    return this._elem.textContent
  }

  getInnerXml () {
    return getInnerXml(this._reader._serializer, this._elem)
  }
}

function getInnerXml (serializer, elem /*, base, lang, ns */) {
  //var frag = elem.ownerDocument.createDocumentFragment()
  var xml = ''
  for (var ei = 0; ei < elem.childNodes.length; ei++) {
    var part = elem.childNodes.item(ei)
    //frag.appendChild(part)
    xml += serializer.serializeToString(part)
  }
  //var xml = serializer.serializeToString(frag)
  return xml
}
