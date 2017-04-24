'use(strict)';

var CONTEXT = '@context',
  GRAPH = '@graph',
  ID = '@id',
  TYPE = '@type',
  VALUE = '@value',
  LANG = '@language';

function visualize(elem, result) {
  var chunks = [];
  var out = chunks.push.bind(chunks);

  function showContext(context) {
    out('<div class="context card">');
    for (var key in context) {
      var value = context[key];
      if (typeof value === 'string') {
        out('<p class="ns">');
        out('<b class="pfx">'+ key +'</b> <a class="ref" href="'+ value +'">'+ value +'</a>');
        out('</p>');
      }
    }
    out('</div>');
  }

  function showNode(node, embedded) {
    var graph = node[GRAPH];
    var id = node[ID];
    var tag = id != null? 'article' : 'div';
    var classes = embedded? 'embedded' : '';
    if (graph) {
      classes += ' graph'
    }
    var idattr = id != null? ' id="'+ id + (graph ? '@graph' : '') +'"' : '';
    out('<'+tag + idattr +' class="card '+ classes +'">');
    out('<header>');
    if (id != null) {
      out('<a class="id" href="#'+ id +'">'+ id +'</a>');
    }
    showType(node);
    out('</header>');
    if (graph) {
      if (Array.isArray(graph)) {
        for (var it of graph) {
          showNode(it);
        }
      }
    } else {
      showContents(node);
    }
    out('</'+tag+'>');
  }

  function showType(node) {
    if (node[TYPE])
      out('<b>'+ node[TYPE] +'</b>');
  }

  function showContents(node, inArray) {
    if (inArray)
      node = {'': node};
    for (var key in node) {
      if (key[0] === '@')
        continue;
      var value = node[key], dt = null, lang = null;
      if (value[VALUE]) {
        lang = value[LANG];
        dt = value[TYPE];
        value = value[VALUE];
      }
      if (typeof value === 'string' || typeof value === 'number' ||
        typeof value === 'boolean') {
        out('<p>');
        if (!inArray) showTerm(key);
        showLiteral(value, lang, dt);
        out('</p>');
      }
      else if (Array.isArray(value)) {
        out('<div>');
        if (!inArray) showTerm(key);
        out('<ul>');
        for (var part of value) {
          out('<li>');
          showContents(part, true);
          out('</li>');
        }
        out('</ul>');
        out('</div>');
      }
      else if (typeof value === 'object') {
        if (value[ID]) {
          out('<p>');
          if (!inArray) showTerm(key);
          showRef(value);
          out('</p>');
        } else {
          out('<div>');
          if (!inArray) showTerm(key);
          showNode(value, true);
          out('</div>');
        }
      }
    }
  }

  function showTerm(key) {
    out('<b>'+ key +'</b>');
  }

  function showRef(node) {
    var id = node[ID];
    out('<a class="ref" href="#'+ id +'">'+ id +'</a>');
  }

  function showLiteral(value, lang, dt) {
    var note = '';
    if (lang)
      note += ' <span class="lang">' + lang +'</span>';
    if (dt)
      note += ' <span class="datatype">' + dt +'</span>';
    out('<span>'+ value + note + '</span>');
  }

  showContext(result[CONTEXT]);

  for (var node of result[GRAPH]) {
    showNode(node);
  }

  elem.innerHTML = chunks.join("\n");
}
