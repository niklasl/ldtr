'use(strict)'

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
} from '../lib/jsonld/keywords.js'

const ANNOTATION = '@annotation'

export function visualize(elem, result, params = {}) {
  var chunks = []
  var out = chunks.push.bind(chunks)

  let context = result[CONTEXT]

  showContext(out, context)

  let nodes = result
  if (!Array.isArray(result)) {
    nodes = result[GRAPH] || result
  }
  if (!Array.isArray(nodes)) nodes = [nodes]

  if (typeof result.byId === 'object' &&
    typeof context.byId === 'object' &&
    context.byId[CONTAINER] === INDEX) {
    nodes = Object.values(result.byId)
  }

  for (var node of nodes) {
    showNode(out, node)
  }

  elem.innerHTML = chunks.join("\n")
}

function showContext(out, context) {
  if (typeof context !== 'object') return

  out('<div class="context">')
  for (let key in context) {
    let value = context[key]
    if (typeof value === 'string') {
      out('<p class="ns">')
      if (key === BASE) {
        out(`<i class="kw">base</i>`)
      } else {
        if (key === VOCAB) key = ''
        out(`<b class="pfx">${key}:</b>`)
      }
      out(`<a class="ref" href="${value}">${value}</a>`)
      out('</p>')
    }
  }
  out('</div>')
}

function showNode(out, node, embedded) {
  var graph = node[GRAPH]
  var id = node[ID]
  var tag = id != null? 'article' : 'div'
  var classes = embedded? 'embedded' : ''
  if (graph) {
    classes += ' graph'
  }

  var idattr = id != null? ' id="'+ id + (graph ? '@graph' : '') +'"' : ''
  out('<'+tag + idattr +' class="card '+ classes +'">')
  out('<header>')
  if (graph) {
    out('<span class="type"><i class="kw">graph</i></span>')
  }
  if (id != null) {
    out('<a class="id" href="'+ id +'">'+ (id || '&nbsp;') +'</a>')
  }
  if (TYPE in node) {
    showType(out, node[TYPE])
  }
  out('</header>')
  showContents(out, node)
  if (graph) {
    if (Array.isArray(graph)) {
      for (var it of graph) {
        showNode(out, it)
      }
    }
  }

  showAnnotation(out, node)

  let revs = node[REVERSE]
  if (revs) {
    showReverses(out, revs)
  }

  out('</'+tag+'>')
}

function showType(out, types) {
  out('<span class="type">')
  if (!Array.isArray(types)) types = [types]
  for (let type of types) {
    let v = typeof type === 'object' ? type[TYPE] : type
    out('<b>'+ v +'</b>')
    showAnnotation(out, type)
  }
  out('</span>')
}

function showContents(out, node, inArray) {
  if (inArray) {
    node = {'': node}
  }

  for (var key in node) {
    if (key[0] === '@')
      continue

    var value = node[key]

    if (isLiteral(value)) {
      out('<div class="p">')
      if (!inArray) showTerm(out, key)
      showLiteral(out, value)
      out('</div>')
    } else if (Array.isArray(value)) {
      out('<div>')
      if (!inArray) showTerm(out, key)
      out('<ul>')
      for (var part of value) {
        out('<li>')
        showContents(out, part, true)
        out('</li>')
      }
      out('</ul>')
      out('</div>')
    } else if (typeof value === 'object') {
      if (value[LIST]) {
        out('<div>')
        showTerm(out, key)
        out('<ol>')
        for (var part of value[LIST]) {
          out('<li>')
          showContents(out, part, true)
          out('</li>')
        }
        out('</ol>')
        showAnnotation(out, value)
        out('</div>')
      } else if (value[ID]) {
        out('<div class="p">')
        if (!inArray) showTerm(out, key)
        showRef(out, value)
        out('</div>')
      } else {
        out('<div>')
        if (!inArray) showTerm(out, key)
        showNode(out, value, true)
        out('</div>')
      }
    }
  }
}

function showTerm(out, key) {
  out('<b>'+ key +'</b>')
}

function showRef(out, node) {
  var id = node[ID]
  out('<a class="ref" href="'+ id +'">'+ id +'</a>')
  showAnnotation(out, node)
}
function isLiteral(value) {
  if (typeof value === 'object' && VALUE in value) return true
  return typeof value === 'string' || typeof value === 'number' ||
        typeof value === 'boolean'
}

function showLiteral(out, value) {
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
  var note = ''
  if (lang)
    note += ' <span class="lang">' + lang +'</span>'
  if (dt)
    note += ' <span class="datatype">' + dt +'</span>'
  out('<span>'+ literal + note + '</span>')
  showAnnotation(out, value)
}

function showReverses(out, revs) {
  out('<aside class="rev">')
  for (let link in revs) {
    out('<div>')
    showTerm(out, `↖ ${link}`)
    out('<ul>')
    for (let part of revs[link]) {
      out('<li>')
      showContents(out, part, true)
      out('</li>')
    }
    out('</ul>')
  }
  out('</div>')
  out('</aside>')
}

function showAnnotation (out, node) {
  let annot = node[ANNOTATION]
  if (annot) {
    out('<div class="annotation">')
    showContents(out, annot)
    out('</div>')
  }
}
