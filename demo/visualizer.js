'use(strict)'

import {
  CONTEXT,
  GRAPH,
  ID,
  TYPE,
  VALUE,
  LANGUAGE as LANG,
  CONTAINER,
  LIST,
  SET,
  INDEX,
  REVERSE
} from '../lib/jsonld/keywords.js'

export function visualize(elem, result, params = {}) {
  var chunks = []
  var out = chunks.push.bind(chunks)

  let context = result[CONTEXT]

  showContext(out, context)

  let nodes = result[GRAPH]

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

  out('<div class="context card">')
  for (var key in context) {
    var value = context[key]
    if (typeof value === 'string') {
      out('<p class="ns">')
      out('<b class="pfx">'+ key +'</b> <a class="ref" href="'+ value +'">'+ value +'</a>')
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
  if (id != null) {
    out('<a class="id" href="#'+ id +'">'+ id +'</a>')
  }
  showType(out, node)
  out('</header>')
  if (graph) {
    if (Array.isArray(graph)) {
      for (var it of graph) {
        showNode(out, it)
      }
    }
  } else {
    showContents(out, node)
  }
  let revs = node[REVERSE]
  if (revs) {
    showReverses(out, revs)
  }
  out('</'+tag+'>')
}

function showType(out, node) {
  if (node[TYPE])
    out('<b>'+ node[TYPE] +'</b>')
}

function showContents(out, node, inArray) {
  if (inArray)
    node = {'': node}
  for (var key in node) {
    if (key[0] === '@')
      continue
    var value = node[key], dt = null, lang = null
    if (value[VALUE]) {
      lang = value[LANG]
      dt = value[TYPE]
      value = value[VALUE]
    }
    if (typeof value === 'string' || typeof value === 'number' ||
      typeof value === 'boolean') {
      out('<p>')
      if (!inArray) showTerm(out, key)
      showLiteral(out, value, lang, dt)
      out('</p>')
    }
    else if (Array.isArray(value)) {
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
    }
    else if (typeof value === 'object') {
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
        out('</div>')
      } else if (value[ID]) {
        out('<p>')
        if (!inArray) showTerm(out, key)
        showRef(out, value)
        out('</p>')
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
  out('<a class="ref" href="#'+ id +'">'+ id +'</a>')
}

function showLiteral(out, value, lang, dt) {
  var note = ''
  if (lang)
    note += ' <span class="lang">' + lang +'</span>'
  if (dt)
    note += ' <span class="datatype">' + dt +'</span>'
  out('<span>'+ value + note + '</span>')
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
