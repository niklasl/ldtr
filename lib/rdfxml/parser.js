'use(strict)';

var RdfXmlParser = (function (exports) {
  if (typeof exports === 'undefined') var exports = {};

  var RDFNS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    XMLNS = 'http://www.w3.org/XML/1998/namespace',
    XMLNSNS = 'http://www.w3.org/2000/xmlns/',
    XSDNS = 'http://www.w3.org/2001/XMLSchema#';

  var XML_ATTRS = {
      'lang': true,
      'base': true
  };
  var RDF_ATTRS = {
      'about': true,
      'ID': true,
      'nodeID': true,
      'resource': true,
      'datatype': true,
      'parseType': true
  };

  exports.parse = function (doc, serializer) {
    var context = {}, graph = [];
    result = {'@context': context, '@graph': graph};
    walk(doc.documentElement, serializer, result);
    return result;
  };

  function walk(elem, serializer, result, node) {
    var attrData = getAttrData(elem.attributes);

    if (attrData.ns) {
      // TODO: if node add local context
      Object.assign(result['@context'], attrData.ns);
    }

    if (attrData.base) {
      result['@context']['@base'] = attrData.base;
    }

    // TODO: if node add local context
    if (!node) {
      if (attrData.lang) {
        result['@context']['@language'] = attrData.lang;
      }
    }

    var childNode = null, consumed = false;

    if (elem.namespaceURI === RDFNS && elem.localName === 'RDF') {
      childNode = node;
    } else {
      if (!node) {
        node = {};
        result['@graph'].push(node);
        if (elem.namespaceURI !== RDFNS || elem.localName !== 'Description') {
          node['@type'] = elem.tagName;
        }

        if (attrData.about) {
          node['@id'] = attrData.about;
        } else if (attrData.ID) {
          node['@id'] = '#'+ attrData.ID;
        } else if (attrData.nodeID) {
          node['@id'] = '_:'+ attrData.nodeID;
        }
        childNode = node;

        Object.assign(node, attrData.values);

      } else {
        var value = null;

        if (attrData.parseType === 'Resource') {
          childNode = {};
          value = childNode;

        } else if (attrData.parseType === 'Collection') {
          var coll = [];
          value = {'@list': coll};
          result = {'@context': {}, '@graph': coll};

        } else if (attrData.parseType === 'Literal') {
          var xml = getInnerXml(serializer, elem);
          value = {'@type': 'rdf:XMLLiteral', '@value': xml};
          consumed = true;
        } else if (attrData.resource) {
          value = {'@id': attrData.resource};

        } else if (attrData.nodeID) {
          value = {'@id': '_:'+ attrData.nodeID};

        } else if (elem.getElementsByTagName('*').length) {
          value = [];
          result = {'@context': {}, '@graph': value};

        } else {
          value = elem.textContent;
          if (attrData.lang) {
            value = {'@value': value, '@language': attrData.lang};
          }else if (attrData.datatype) {
            value = {'@value': value, '@type': attrData.datatype};
          }
        }
        var props = node[elem.tagName];
        if (!props) {
          node[elem.tagName] = value;
        } else {
          if (!Array.isArray(props)) {
            node[elem.tagName] = props = [props];
          }
          props.push(value);
        }
      }
    }

    if (consumed)
      return;

    for (var ni=0; ni < elem.childNodes.length; ni++) {
      var child = elem.childNodes.item(ni);
      if (child.nodeType === 1) {
        walk(child, serializer, result, childNode);
      }
    }
  }

  function getAttrData(attributes) {
    var attrData = {
      ns: {},
      values: {}
    };
    for (var ai=0; ai < attributes.length; ai++) {
      var attr = attributes.item(ai),
        nsUri = attr.namespaceURI,
        lname = attr.localName,
        value = attr.value;
      if (nsUri === XMLNSNS) {
        var pfx = lname;
        if (pfx === 'xmlns') {
          pfx = '@vocab';
        }
        attrData.ns[pfx] = value;
      } else if (nsUri === XMLNS && XML_ATTRS[lname]) {
        attrData[lname] = value;
      } else if (nsUri === RDFNS && RDF_ATTRS[lname]) {
        attrData[lname] = value;
      } else {
        attrData.values[attr.name] = value;
      }
    }
    return attrData;
  }

  function getInnerXml(serializer, elem /*, base, lang, ns*/) {
    //var frag = elem.ownerDocument.createDocumentFragment();
    var xml = "";
    for (var ei=0; ei < elem.childNodes.length; ei++) {
      var part = elem.childNodes.item(ei);
      //frag.appendChild(part);
      xml += serializer.serializeToString(part);
    }
    //var xml = serializer.serializeToString(frag);
    return xml;
  }

  return exports;
})(typeof exports !== 'undefined'? exports : {});
