'use(strict)';

if (typeof require === 'function') {
  var RDFaContexts = require("./contexts");
}

var RDFaWalker = (function () {
  if (typeof exports === 'undefined') exports = {};

  var RDF_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  var XHV_IRI = "http://www.w3.org/1999/xhtml/vocab#";
  var RDF_XML_LITERAL = RDF_IRI + 'XMLLiteral';
  var RDFA_USES_VOCAB = 'rdfa:usesVocabulary';

  function walk(builder, doc, base, options) {
    options = options != null? options : {};
    options.profile = options.profile != null? options.profile : 'html';
    options.compact = options.compact != null? options.compact : false;
    var state = init(doc, base, options);
    builder.start(state);
    visit(builder, doc.documentElement, state);
    return builder.complete(state);
  }

  function init(doc, base, options) {
    // TODO: if (require) require('url').resolve(from, to)
    var resolver = doc.createElement('a');
    function resolveURI(ref) {
      resolver.href = ref;
      return resolver.href;
    }
    var baseElems = doc.getElementsByTagName('base');
    if (baseElems.length) {
      base = resolveURI('') || baseElems[0].getAttribute('href');
    }
    var state = new State(base, options, resolveURI);
    return state;
  }

  function visit(builder, el, state) {
    if (el.attributes.length) {
      var desc = new Description(el, state); //getDescription(el, state) // el.rdfa
      var change = builder.visit(desc, state);
      if (change) {
        state = state.createSubState(desc, change.subject, change.incomplete);
        builder.visited(change.subject, state);
      }
    }
    for (var i=0, l=el.childNodes, ln=l.length; i < ln; i++) {
      var child = l[i];
      if (child.nodeType === 1) {
        visit(builder, child, state);
      }
    }
  }


  function State(base, options, resolveURI) {
    this.context = new Context(options, resolveURI, base);
    this.lang = null;
    this.incomplete = null;
    this.subject = base;
    this.getNextBNode = bnodeCounter();
    this.usesVocabExpr = this.context.expandCurieOrIRI(RDFA_USES_VOCAB)
  }
  State.name = 'State';
  State.prototype = {
    createSubState: function (desc, subject, incomplete) {
      var subState;
      subState = inherit(this);
      subState.context = desc.context;
      subState.lang = desc.lang;
      subState.subject = subject;
      subState.incomplete = incomplete;
      return subState;
    }
  };


  function bnodeCounter() {
    // TODO: marker for proper blank?
    var prefix = "_:gen-" + ((new Date().getTime()).toString(16)) + "-";
    var count = 0;
    return function () {
      return prefix + count++;
    };
  }


  function Context(options, resolveURI, base, vocab, prefixes) {
    this.resolveURI = resolveURI;
    this.options = options;
    this.base = base;
    this.vocab = vocab != null ? vocab : null;
    this.prefixes = prefixes != null ? prefixes : {};

    this.profile = options.profile;
    this.defaultContext = RDFaContexts[this.profile];
    this.compact = options.compact;
  }
  Context.name = 'Context';
  Context.prototype = {

    createSubContext: function (base, vocab, prefixes) {
      if (base == null) {
        base = this.base;
      }
      if (vocab == null) {
        vocab = this.vocab;
      }
      var subPrefixes = inherit(this.prefixes);
      for (var pfx in prefixes) {
        var iri = prefixes[pfx];
        subPrefixes[pfx] = iri;
      }
      return new Context(this.options, this.resolveURI, base, vocab, subPrefixes);
    },

    expandTermOrCurieOrIRI: function (expr) {
      if (this.noticeExpr(expr) && this.compact) {
        return expr;
      }

      var iri;
      if (expr.indexOf(":") !== -1) {
        return this.expandCurieOrIRI(expr);
      }
      if (this.vocab) {
        return this.vocab + expr;
      }
      iri = this.prefixes[expr] || this.prefixes[expr.toLowerCase()];
      if (iri) {
        return iri;
      }
      return null;
    },

    expandCurieOrIRI: function (expr) {
      if (this.noticeExpr(expr) && this.compact) {
        return expr;
      }

      var safeCurie = false;
      if (expr.match(/^\[(.+)]$/)) {
        expr = RegExp.$1;
        safeCurie = true;
      }
      var i = expr.indexOf(':');
      if (i === -1) {
        // TODO: if safeCurie then error and return null
        return expr;
      }
      var pfx = expr.substring(0, i);
      var term = expr.substring(i + 1);
      if (pfx === '_') {
        return expr;
      }
      if (term.slice(0, 2) === "//") {
        return expr;
      }
      if (pfx.length === 0) {
        return XHV_IRI + term;
      }
      var ns = this.prefixes[pfx];
      if (ns) {
        return ns + term;
      }
      return expr;
    },

    expandAndResolve: function (curieOrIri) {
      if (curieOrIri === '[]') {
        // TODO: expandOrResolve?
        return null;
      }
      var iri = this.expandCurieOrIRI(curieOrIri);
      if (iri[0] === '_') {
        return iri;
      }
      // TODO: hack to avoid jsdom(?) lowercasing e.g. urn:isbn:* to urn:isbn:*!
      var resolved = this.resolveURI(iri);
      if (resolved.length === iri.length) {
        return iri;
      }
      return resolved;
    },

    noticeExpr: function (expr) {
      var i = expr.indexOf(":");
      if (i !== -1) expr = expr.substring(0, i);
      if (this.prefixes[expr]) {
        return true
      }
      var defaultValue = this.defaultContext[expr];
      if (defaultValue) {
        this.prefixes[expr] = defaultValue;
        return true;
      }
      return i === -1 && this.vocab != null;
    }

  };


  /**
   * A representation of the interpreted description formed by the logical
   * attributes of an element. Use this to produce triples.
   */
  function Description(el, state) {
    // TODO: state or= computeState(el)
    this.parentSubject = state.subject;
    this.parentIncomplete = state.incomplete;

    var data = new ElementData(el, state.context, this.parentSubject);
    this.errors = data.errors;
    var lang = data.getLang();
    this.lang = lang != null? lang : state.lang;
    this.vocab = data.getVocab();
    this.context = data.context;

    this.types = data.getTypes();

    var props = data.getProperties();
    var resource = data.getResource();
    var rels = data.getRels();
    var revs = data.getRevs();
    var about = data.getAbout();

    var resourceIsTyped = !!(this.types && !data.attrs.about);
    var hasContentAttrs = !!((data.contentAttr != null) || (data.datatypeAttr != null));
    var propsAsLinks = !!(props && (!(rels || revs)) &&
      (resource || resourceIsTyped) && !hasContentAttrs);

    this.contentProperties = props && !propsAsLinks ? props : null;
    this.linkProperties = rels ? rels : propsAsLinks ? props : null;

    this.reverseLinkProperties = revs || null;
    this.inlist = data.isInlist();

    if (resource) {
      this.resource = resource;
    } else if (resourceIsTyped && (rels || props)) {
      this.resource = state.getNextBNode();
    }

    this.scoped = this.resource && (!(propsAsLinks || hasContentAttrs)) || resourceIsTyped;

    if (about) {
      this.subject = about;
    } else {
      var hasLinks = this.linkProperties || this.reverseLinkProperties;
      if (this.resource && !hasLinks) {
        this.subject = this.resource;
      } else if (this.types && !(this.contentProperties || hasLinks)) { // TODO: redundancy?
        this.subject = state.getNextBNode();
      }
    }

    if (this.contentProperties) {
      var lit = data.getLiteral();
      if (lit) {
        this.content = lit.value;
        this.datatype = lit.datatype;
      }
    }
  }
  Description.name = 'Description';
  Description.prototype = {};


  /**
   * A representation of the logical data expressed by an element. This takes
   * context mappings into account, but does not interpret the attribute
   * interplay and generation of triples.
   */
  function ElementData(el, parentContext, parentSubject) {
    this.el = el;
    this.attrs = {};
    for (var ai=0; ai < el.attributes.length; ai++) {
      var attr = el.attributes.item(ai);
      this.attrs[attr.localName] = attr;
    }
    this.isRoot = this.el.parentNode === this.el.ownerDocument;
    this.tagName = this.el.nodeName.toLowerCase();
    this.parentSubject = parentSubject;
    this.errors = [];
    this.context = parentContext.createSubContext(
      this.getBase(), this.getVocab(), this.getPrefixes());
    this.contentAttr = this.getContentAttr();
    this.datatypeAttr = this.getDatatypeAttr();
  }
  ElementData.name = 'ElementData';
  ElementData.prototype = {

    getBase: function () {
      // only use if XML-based profile
      var attr = this.attrs['xml:base'];
      if (attr != null) return attr.value;
    },

    getLang: function () {
      var lang = this.attrs['xml:lang'];
      if (lang == null) lang = this.attrs['lang'];
      if (lang != null) return lang.value;
    },

    getContentAttr: function () {
      if (this.context.profile === 'html') {
        if (this.tagName === 'time' && (this.attrs.datetime != null)) {
          return this.attrs.datetime.value;
        } else if (this.tagName === 'data' && (this.attrs.value != null)) {
          return this.attrs.value.value;
        }
      }
      if (this.attrs.content != null) {
        return this.attrs.content.value;
      }
    },

    getDatatypeAttr: function () {
      var dt;
      if (this.attrs.datatype != null) {
        dt = this.attrs.datatype.value;
        if (!dt) {
          return "";
        }
        return this.context.expandTermOrCurieOrIRI(dt);
      }
    },

    getVocab: function () {
      var attr = this.attrs['vocab'];
      if (attr != null) return attr.value;
    },

    getPrefixes: function () {
      var prefixes = this.getNamespaces();
      var attr = this.attrs['prefix'];
      if (!attr) {
        return prefixes;
      }
      var pfxs = attr.value.replace(/^\s+|\s+$/g, "").split(/:?\s+/);
      for (var i = 0, len = pfxs.length; i < len; i += 2) {
        var pfx = pfxs[i];
        var ns = pfxs[i + 1];
        prefixes[pfx] = ns;
      }
      return prefixes;
    },

    getNamespaces: function () {
      var prefixes = {};
      for (var ai=0; ai < this.el.attributes.length; ai++) {
        var attr = this.el.attributes.item(ai);
        if (attr.name.match(/^xmlns:/)) {
          prefixes[attr.name.substring(6)] = attr.value;
        }
      }
      return prefixes;
    },

    getAbout: function () {
      var id;
      if (this.attrs.about != null) {
        id = this.context.expandAndResolve(this.attrs.about.value);
        if (id) {
          return id;
        }
      }
      if (this.isRoot) {
        return this.parentSubject;
      }
      if ((this.tagName === 'head' || this.tagName === 'body') && !(this.attrs.resource != null)) {
        return this.parentSubject;
      }
    },

    getResource: function () {
      var id;
      if (this.attrs.resource != null) {
        id = this.context.expandAndResolve(this.attrs.resource.value);
        if (id) {
          return id;
        }
      }
      if (this.attrs.href != null) {
        return this.context.resolveURI(this.attrs.href.value);
      }
      if (this.attrs.src != null) {
        return this.context.resolveURI(this.attrs.src.value);
      }
    },

    getTypes: function () {
      // TODO: in jsdom, typeof is expanded to typeof="typeof"
      var values = this.getAndExpand('typeof');
      if (values) {
        values = values.filter(function (v) { return v !== 'typeof'; });
      }
      return this.expandAll(values);
    },

    getProperties: function () {
      return this.getAndExpand('property');
    },

    getRels: function () {
      return this.getAndExpand('rel');
    },

    getRevs: function () {
      return this.getAndExpand('rev');
    },

    getAndExpand: function (name) {
      var attr = this.attrs[name];
      if (attr != null) return this.expandAll(attr.value.split(/\s+/));
    },

    expandAll: function (expressions, weak) {
      if (weak == null) {
        weak = false;
      }
      if (!expressions) {
        return null;
      }
      var result = [];
      var isHtml = this.context.profile === 'html';
      var prop = this.attrs.property != null;
      var muted = false;
      for (var i = 0, len = expressions.length; i < len; i++) {
        var expr = expressions[i];
        if (weak && isHtml && prop && expr.indexOf(':') === -1) {
          muted = true;
          continue;
        }
        var iri = this.context.expandTermOrCurieOrIRI(expr);
        if (iri && iri[0] !== '_') {
          result.push(iri);
        }
      }
      if (muted && result.length === 0) {
        return null;
      }
      return result;
    },

    getLiteral: function () {
      var datatype = this.getDatatype();
      var lang = this.getLang();
      var content, xml;
      if (datatype === RDF_XML_LITERAL) {
        xml = this.getXML();
      } else {
        content = this.getContent();
      }
      if (content != null) {
        if (datatype) {
          return {value: content, datatype: datatype};
        } else if (lang) {
          return {value: content, lang: lang};
        } else {
          return {value: content};
        }
      } else { // if xml
        return {value: xml, datatype: datatype};
      }
    },

    getContent: function () {
      return this.contentAttr || this.el.textContent;
    },

    getXML: function () {
      return this.el.innerHTML;
    },

    getDatatype: function () {
      var value;
      if (this.datatypeAttr) {
        return this.datatypeAttr;
      } else if (this.context.profile === 'html' && this.tagName === 'time') {
        value = this.getContent();
        // TODO: use full iri unless compact..
        if (value.indexOf(' ') !== -1) {
          return null;
        }
        if (value[0] === 'P') {
          return this.context.expandTermOrCurieOrIRI('xsd:duration');
        }
        if (value.indexOf('T') > -1) {
          return this.context.expandTermOrCurieOrIRI('xsd:dateTime');
        } else if (value.indexOf(':') > -1) {
          return this.context.expandTermOrCurieOrIRI('xsd:time');
        } else if (value.match(/^\d{4,}$/)) {
          return this.context.expandTermOrCurieOrIRI('xsd:gYear');
        } else if (value.match(/^\d{4,}-\d{2}$/)) {
          return this.context.expandTermOrCurieOrIRI('xsd:gYearMonth');
        } else if (value.match(/^\d{4,}-\d{2}-\d{2}(Z|[+-]\d{2}:?\d{2})?$/)) {
          return this.context.expandTermOrCurieOrIRI('xsd:date');
        }
      }
      return null;
    },

    isInlist: function () {
      return this.attrs.inlist !== void 0;
    }

  };

  function inherit(obj) {
    var ctor;
    ctor = function () {};
    ctor.prototype = obj;
    return new ctor();
  }

  exports.walk = walk;
  exports.Description = Description;
  exports.State = State;
  exports.Context = Context;
  exports.ElementData = ElementData;
  return exports;
})();
