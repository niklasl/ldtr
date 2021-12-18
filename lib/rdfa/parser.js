'use(strict)'

import {DOMParser} from '../compat.js'
import * as RDFaWalker from './walker.js'

var ID = '@id'

export function parse (doc, base, options) {
  if (typeof window !== 'undefined') {
    if (doc == null) {
      doc = window.document
    } else if (typeof doc === 'string') {
      doc = new DOMParser().parseFromString(xmlStr, 'text/html')
    }
    if (!base) {
      base = window.location.href
    }
  }
  return RDFaWalker.walk(builder, doc, base, options)
}

var builder = {

  start: function (state) {
    state.result = {
      topContext: {},
      all: {}
    }
  },

  visit: function (desc, state) {
    var result = state.result

    if (desc.vocab) {
      var baseObj = getOrCreateNode(result, desc.context.resolveURI(''))
      addPropToObj(state, baseObj, state.usesVocabExpr, {
        '@id': desc.vocab
      })
    }

    var activeSubject = desc.subject != null ? desc.subject : desc.parentSubject
    var currentNode = getOrCreateNode(result, activeSubject)
    var localNode = getOrCreateNode(result, desc.subject != null ? desc.subject : desc.resource)

    var links = desc.linkProperties
    var revLinks = desc.reverseLinkProperties
    var props = desc.contentProperties
    var inlist = desc.inlist
    var incomplete = desc.parentIncomplete
    var hasLinks = !!(links || revLinks)

    if (state.keepList) {
      state.keepList = incomplete !== null || activeSubject === desc.parentSubject
    }

    if (!(desc.subject != null || hasLinks || props)) {
      return {subject: activeSubject, incomplete: incomplete}
    }

    var adder
    if (incomplete) {
      var completedNode = getOrCreateNode(result, incomplete.subject)
      var completingNode
      if (desc.subject != null) {
        completingNode = localNode
      } else {
        completingNode = getOrCreateNode(result, incomplete.incompleteSubject)
        currentNode = completingNode
      }
      adder = incomplete.inlist ? addToPropListToObj : addPropToObj
      if (incomplete.linkProperties) {
        incomplete.linkProperties.forEach(function (rel) {
          adder(state, completedNode, rel, {
            '@id': completingNode[ID]
          })
        })
      }
      if (incomplete.reverseLinkProperties) {
        incomplete.reverseLinkProperties.forEach(function (rev) {
          adder(state, completingNode, rev, {
            '@id': completedNode[ID]
          })
        })
      }
      incomplete = null
    }

    if (hasLinks && desc.resource == null) {
      incomplete = {
        linkProperties: links,
        reverseLinkProperties: revLinks,
        inlist: inlist,
        subject: currentNode[ID],
        incompleteSubject: state.getNextBNode()
      }
    }

    var types = desc.types
    if (types) {
      types.forEach(function (type) {
        addPropToObj(state, localNode, '@type', type)
      })
    }

    adder = inlist ? addToPropListToObj : addPropToObj

    var resource = desc.resource
    var oNode = null
    var nestedNode = currentNode
    if (resource != null) {
      oNode = getOrCreateNode(result, resource)
      if (desc.scoped) {
        nestedNode = oNode
      }
      var oref = {'@id': resource}
      if (revLinks) {
        var sref = {'@id': activeSubject}
        revLinks.forEach(function (rev) {
          adder(state, oNode, rev, sref)
        })
      }
    }
    if (resource != null || inlist) {
      if (links) {
        links.forEach(function (rel) {
          adder(state, currentNode, rel, oref)
        })
      }
    }

    var content = desc.content
    if ((content != null) || inlist) {
      var literal
      if (content != null) {
        literal = makeLiteral(content, desc.datatype, desc.lang)
      }
      if (props) {
        props.forEach(function (prop) {
          adder(state, currentNode, prop, literal)
        })
      }
    }

    return {subject: nestedNode[ID], incomplete: incomplete}
  },

  visited: function (node, state) {
    var ctx = state.result.topContext
    for (var pfx in state.context.prefixes) {
      ctx[pfx] = state.context.prefixes[pfx]
    }
    if (state.context.vocab) {
      ctx['@vocab'] = state.context.vocab
    }
    if (state.context.base) {
      ctx['@base'] = state.context.base
    }
  },

  complete: function (state) {
    var items = []
    var all = state.result.all
    for (var s in all) {
      var obj = all[s]
      var add = false
      for (var key in obj) {
        if (key !== '@id') {
          add = true
          break
        }
      }
      if (add) {
        items.push(obj)
      }
    }
    // //return items
    var ctx = state.result.topContext
    return {'@context': ctx, '@graph': items}
  }

}

var getOrCreateNode = function (result, id) {
  var obj
  obj = result.all[id]
  if (!obj) {
    obj = result.all[id] = {'@id': id}
  }
  return obj
}

var addPropToObj = function (state, obj, prop, value) {
  var values
  values = obj[prop]
  if (!values) {
    values = obj[prop] = []
  } else if (!values.push) {
    values = obj[prop] = [values]
  }
  return values.push(value)
}

var addToPropListToObj = function (state, obj, prop, value) {
  var values = obj[prop]
  // TODO: list in Array or direct object (latter prevents sets of mixed refs+lists)
  if (values instanceof Array) {
    if (values[0]['@list'] && state.keepList) {
      values = values[0]['@list']
    } else {
      var l = []
      values.unshift({'@list': l})
      values = l
    }
  } else if (values) {
    if (state.keepList) {
      values = values['@list']
    } else {
      var newList = []
      obj[prop] = [
        values, {'@list': newList}
      ]
      values = newList
    }
  } else {
    values = []
    obj[prop] = {'@list': values}
  }
  if (value != null) {
    values.push(value)
  }
  state.keepList = true
}

var makeLiteral = function (value, datatype, lang) {
  if (datatype) { // and datatype isnt rdf:langString
    return {'@value': value, '@type': datatype}
  } else if (lang) {
    return {'@value': value, '@language': lang}
  } else {
    return value // {"@value": value}
  }
}
