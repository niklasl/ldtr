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

import { ANNOTATION, ANNOTATED_TYPE_KEY, REIFIES, TRIPLE, QUOTED } from '../lib/jsonld/star.js'

function asArray(o) {
  return Array.isArray(o) ? o : o != null ? [o] : o
}

export function visualize(elem, result, params = {}) {
  var chunks = []
  var out = chunks.push.bind(chunks)

  let context = result[CONTEXT]

  showContext(out, context)

  let nodes = result
  if (!Array.isArray(result)) {
    nodes = result[GRAPH] || result
  }

  nodes = asArray(nodes)

  if (typeof result.byId === 'object' &&
    typeof context.byId === 'object' &&
    context.byId[CONTAINER] === INDEX) {
    nodes = Object.values(result.byId)
  }

  for (var node of nodes) {
    showNode(out, node, 'topblank')
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

function showNode(out, node, classes = '') {
  var graph = node[GRAPH]

  var id = node[ID]

  if (!id && graph /*&& parentGraph*/) id = false

  var tag = id != null || classes === 'topblank' ? 'article' : 'div'

  if (graph) {
    classes += ' graph'
  }

  var idattr = id != null ? ' id="'+ id + (graph ? '@graph' : '') +'"' : ''
  out('<'+tag + idattr +' class="card '+ classes +'">')

  out('<header>')
  if (graph) {
    out('<span class="type"><i class="kw">graph</i></span>')
  }
  if (id != null) {
    /*
    if (typeof id === 'object') {
      showQuotedTriple(out, id)
    } else {
      out('<a class="id" href="'+ id +'">'+ (id || '&nbsp;') +'</a>')
    }
    */
  out('<a class="id" href="'+ id +'">'+ (id || '&nbsp;') +'</a>')
  }

  if (TYPE in node) {
    showType(out, node[TYPE])
  }

  out('</header>')

  showContents(out, node)

  if (graph) {
    graph = asArray(graph)
    for (var it of graph) {
      showNode(out, it, 'topblank')
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
  types = asArray(types)
  for (let type of types) {
    let v = typeof type === 'object' ? type[ANNOTATED_TYPE_KEY] : type
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
    var value = node[key]

    if (key == TRIPLE) {
      showQuotedTriple(out, value)
      continue
    }

    const isQuoted = key === QUOTED
    if (key[0] === '@' && !isQuoted)
      continue

    if (typeof value === 'object' && TRIPLE in value) {
        out('<div class="p triple">')
        if (!inArray) showTerm(out, key)
        showQuotedTriple(out, value[TRIPLE])
        out('</div>')
    } else if (isLiteral(value)) {
      out(isQuoted ? '<div class="quoted p">' : '<div class="p">')
      if (!inArray) showTerm(out, key)
      showLiteral(out, value)
      out('</div>')
    } else if (Array.isArray(value)) {
      out(isQuoted ? '<div class="quoted">' : '<div>')
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
        out(isQuoted ? '<div class="quoted">' : '<div>')
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
        out(isQuoted ? '<div class="quoted p">' : '<div class="p">')
        if (!inArray) showTerm(out, key)
        showRef(out, value)
        out('</div>')
      } else {
        out(isQuoted ? '<div class="quoted">' : '<div>')
        if (!inArray) showTerm(out, key)
        showNode(out, value, 'embedded')
        out('</div>')
      }
    }
  }
  if (REIFIES in node) {
    out('<div class="quoted">')
    for (const sub of asArray(node[REIFIES])) {
      showNode(out, sub, 'quoted')
    }
    out('</div>')
  }
}

function showTerm(out, key) {
  if (key === QUOTED) return
  out('<b>'+ key +'</b>')
}

function showRef(out, node) {
  var id = node[ID]
  /*
  if (typeof id === 'object') {
    out('<div class="ref">')
    showQuotedTriple(out, id)
    out('</div>')
    return
  }
  */

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
  if (typeof literal === 'string') {
    literal = literal.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  }
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
  let annots = node[ANNOTATION]
  if (annots) {
    annots = asArray(annots)
    if (annots.length > 1) {
      out('<div class="annotations">')
    }
    for (const annot of annots) {
      out('<div class="annotation">')
      const id = annot[ID]
      if (id && typeof id !== 'object') {
        out('<a class="ref" href="'+ id +'">'+ id +'</a>')
      }
      if (TYPE in annot) {
        showType(out, annot[TYPE])
      }
      showContents(out, annot)
      out('</div>')
    }
    if (annots.length > 1) {
      out('</div>')
    }
  }
}

function showQuotedTriple (out, id) {
  showNode(out, id, 'triple')
}
