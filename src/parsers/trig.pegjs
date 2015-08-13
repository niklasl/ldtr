/**
 * A PEG.js <http://pegjs.org/> Grammar File for TriG <http://www.w3.org/TR/trig/#sec-grammar>.
 */

{

    function assign(target, source) {
        for (var key in source) {
            target[key] = source[key];
        }
        return target;
    }

    function contextItem(key, value) {
        var decl = {}
        decl[key] = value;
        return {'@context': decl};
    }

    function prefix(pfx, iriref) {
        return contextItem(pfx || '@vocab', iriref['@id']);
    }

    function base(iriref) {
        return contextItem('@base', iriref['@id']);
    }

    function reducePairs(subject, pairs) {
        if (subject === null) {
            subject = '';
        }
        if (typeof subject === 'string') {
            if (subject.indexOf(':') === -1) {
                subject = ':' + subject;
            }
            subject = {'@id': subject};
        }
        for (var pair of pairs) {
            for (var key in pair) {
                var value = pair[key];
                var existing = subject[key];
                if (typeof existing !== 'undefined') {
                    if (!Array.isArray(existing)) {
                        existing = [existing];
                    }
                    if (Array.isArray(value)) {
                        existing.concat(value);
                    } else {
                        existing.push(value);
                    }
                    value = existing;
                }
                subject[key] = value;
            }
        }
        return subject;
    }

    var echars = {
        t: '\t',
        b: '\b',
        n: '\n',
        r: '\r',
        f: '\f',
        '"': '"',
        "'": "'",
        '\\': '\\'
    };

}

trigDoc =
    IGNORE data:(directive / block)* IGNORE
    {
        var currentContext = {}, currentGraph = [];
        var result = [
            {'@context': currentContext, '@graph': currentGraph}
        ];
        var vocab = null;
        for (var item of data) {
            var ctxItem = item['@context'];
            if (ctxItem) {
                if (currentGraph.length !== 0) {
                    currentContext = {};
                    currentGraph = [];
                    result.push(
                        {'@context': currentContext, '@graph': currentGraph}
                    );
                }
                assign(currentContext, ctxItem);
                vocab = currentContext['@vocab'];
            } else if (Array.isArray(item)) {
                currentGraph.push.apply(currentGraph, item);
            } else {
                var id = item['@id'];
                if (id && id[0] === ':') {
                    item['@id'] = vocab + id.substring(1);
                }
                currentGraph.push(item);
            }
        }
        return result.length === 1? result[0] : result;
    }

block =
    triplesOrGraph / g:wrappedGraph { return g['@graph']; } / triples2 /
    IGNORE "GRAPH"i name:labelOrSubject wg:wrappedGraph {
        return assign(name, wg);
    }

triplesOrGraph =
    subject:labelOrSubject labelled:(wrappedGraph /
                                 pos:predicateObjectList IGNORE '.' { return pos; } )
    {
        if (typeof labelled['@graph'] !== 'undefined') {
            return assign(subject, labelled);
        } else {
            return reducePairs(subject, labelled);
        }
    }

triples2 =
    bnpairs:blankNodePropertyList pos:predicateObjectList? IGNORE '.'
    {
        return pos? reducePairs(bnpairs, pos) : bnpairs;
    }
    / collection:collection pos:predicateObjectList IGNORE '.'
    {
        return pos? reducePairs(bnpairs, pos) : bnpairs;
    }

wrappedGraph =
    IGNORE '{' tb:triplesBlock? IGNORE '}' IGNORE
    {
        return {'@graph': tb};
    }

triplesBlock =
    triples:triples next:('.' block:triplesBlock? { return block; } )?
    {
        var items = [triples];
        if (next) {
            items.push.apply(items, next);
        }
        return items;
    }

labelOrSubject = iri / BlankNode

directive = prefixID / base / sparqlPrefix / sparqlBase

prefixID =
    '@prefix' IGNORE pfx:PNAME_NS IGNORE iriref:IRIREF IGNORE '.' IGNORE
    {
        return prefix(pfx, iriref);
    }

base =
    '@base' IGNORE iriref:IRIREF IGNORE '.' IGNORE
    {
        return base(iriref);
    }

sparqlPrefix =
    "PREFIX"i IGNORE pfx:PNAME_NS IGNORE iriref:IRIREF IGNORE
    {
        return prefix(pfx, iriref);
    }

sparqlBase =
    "BASE"i IGNORE iriref:IRIREF IGNORE
    {
        return base(iriref);
    }

triples =
    subject:subject pos:predicateObjectList
    {
        return reducePairs(subject, pos);
    }
    / blankNodePropertyList predicateObjectList?

predicateObjectList =
    verb:verb objectList:objectList rest:(';' vol:(verb objectList)? { return vol; } )* IGNORE
    {
        function toPair(verb, objectList) {
            var po = {};
            po[verb] = objectList;
            return po;
        }
        var po = toPair(verb, objectList);
        var pairs = [po];
        for (var pair of rest) {
            if (pair === null) // last ';', so we could also break
                continue
            po = toPair(pair[0], pair[1]);
            pairs.push(po);
        }
        return pairs;
    }

objectList =
    first:object remainder:(IGNORE ',' IGNORE  object:object { return object; } )*
    {
        if (remainder.length > 0) {
            var objects = [first];
            for (var object of remainder) {
                objects.push(object);
            }
            return objects;
        } else {
            return first;
        }
    }

verb =
    IGNORE verb:(predicate / 'a' {return '@type'; } ) IGNORE
    {
        var id = verb['@id'];
        if (id)
            return id;
        return verb;
    }

subject = iri / blank
predicate = iri
object = iri / blank / blankNodePropertyList / literal

literal =
    IGNORE literal:(RDFLiteral / NumericLiteral / BooleanLiteral) IGNORE
    {
        return literal;
    }

blank = BlankNode / collection

blankNodePropertyList =
    IGNORE '[' pos:predicateObjectList ']' IGNORE
    {
        return reducePairs({}, pos);
    }

collection = IGNORE '(' IGNORE collection:object* IGNORE ')' IGNORE
    {
        return {'@list': collection};
    }

// NOTE: PEG.js needed reversed match order
NumericLiteral =
    DOUBLE / DECIMAL / INTEGER

RDFLiteral =
    rdfliteral: String tag:(LANGTAG /
                            '^^' datatype:iri { return {'@type': datatype}; } )?
    {
        var value = rdfliteral;
        if (tag !== null) {
            value = {'@value': rdfliteral};
            assign(value, tag);
        }
        return value;
    }

BooleanLiteral =
    'true' { return true; } / 'false' { return false; }

// NOTE: PEG.js needed long quotes before regular
String =
    IGNORE value:(STRING_LITERAL_LONG_SINGLE_QUOTE / STRING_LITERAL_LONG_QUOTE /
                  STRING_LITERAL_QUOTE / STRING_LITERAL_SINGLE_QUOTE) IGNORE
    {
        return value;
    }

iri =
    IGNORE iri:(IRIREF / PrefixedName) IGNORE
    {
        return iri;
    }

PrefixedName = PNAME_LN / PNAME_NS

BlankNode =
    IGNORE bnode:(BLANK_NODE_LABEL / ANON) IGNORE
    {
        return bnode;
    }

// Productions for terminals

IRIREF =
    '<' iriref:([^\u0000-\u0020<>"{}|^`\\] / UCHAR)* '>'
    {
        return {"@id": iriref.join('')};
    }

PNAME_NS =
    pfx:PN_PREFIX? ':'
    {
        return pfx;
    }

// TODO: needed PN_LOCAL with appended + below for parser to accept e.g. terminating ';'
PNAME_LN = ns:PNAME_NS l:PN_LOCAL+
    {
        return (ns === null? '' : ns + ':') + l.join('');
    }

BLANK_NODE_LABEL =
    lead:'_:' first:(PN_CHARS_U / [0-9]) rest:((PN_CHARS / '.')* PN_CHARS)?
    {
        var bid = lead;
        if (first)
            bid += first.join('');
        if (rest)
            bid += first.join('');
        return {'@id': bid};
    }

LANGTAG =
    '@' tag:[a-zA-Z]+ subtag:('-' [a-zA-Z0-9]+)*
    {
        var sub = (subtag.length? subtag.map(function (it) {
            return it[0] + it[1].join(''); }).join('') : '');
        return {"@language": tag.join('') + sub};
    }

INTEGER =
    sign:[+-]? digits:[0-9]+
    {
        var i = parseInt(digits.join(''), 10);
        if (sign === '-')
            i = -1 * i;
        return i;
    }

DECIMAL =
    sign:[+-]? digits:(whole:[0-9]* '.' fraction:[0-9]+ {
            return (whole? whole.join('') : '') + '.' + fraction.join('');
        })
    {
        return parseFloat((sign || '') + digits, 10);
    }

DOUBLE =
    sign:[+-]? digits:(
        whole:[0-9]+ '.' fraction:[0-9]* exp:EXPONENT {
            return whole.join('') + '.' +
                (fraction? fraction.join('') : '') + exp;
        }
        / '.' fraction:[0-9]+ exp:EXPONENT {
            return fraction.join('') + exp;
        }
        / whole:[0-9]+ exp:EXPONENT {
            return whole.join('') + exp;
        }
    )
    {
        return parseFloat((sign || '') + digits, 10);
    }

EXPONENT =
    e:[eE] sign:[+-]? digits:[0-9]+
    {
        return e + (sign || '') + digits.join('');
    }

STRING_LITERAL_QUOTE =
    '"' value:([^\u0022\u005C\u000A\u000D] / ECHAR / UCHAR)* '"'
    {
        return value.join('');
    }

STRING_LITERAL_SINGLE_QUOTE =
    "'" value:([^\u0027\u005C\u000A\u000D] / ECHAR / UCHAR)* "'"
    {
        return value.join('');
    }

STRING_LITERAL_LONG_SINGLE_QUOTE =
    "'''" value:(first:("'" / "''")?
                 rest:([^'\\] / ECHAR / UCHAR)
                       { return (first || '') + rest; } )* "'''"
    {
        return value.join('');
    }

STRING_LITERAL_LONG_QUOTE =
    '"""' value:(first:('"' / '""')?
                 rest:([^"\\] / ECHAR / UCHAR)
                      { return (first || '') + rest; } )* '"""'
    {
        return value.join('');
    }

UCHAR = '\\u' hex:(HEX HEX HEX HEX)
    {
        return String.fromCharCode(parseInt(hex.join(''), 16));
    }
    / '\\U' hex:(HEX HEX HEX HEX HEX HEX HEX HEX)
    {
        return String.fromCharCode(parseInt(hex.join(''), 16));
    }

ECHAR =
    '\\' chr:[tbnrf"'\\]
    {
        return echars[chr];
    }

NIL =
    '(' IGNORE ')'

WS =
    '\u0020' / '\u0009' / '\u000D' / '\u000A'

ANON = '[' IGNORE ']' { return {}; }

PN_CHARS_BASE = [A-Z] / [a-z] / [\u00C0-\u00D6] / [\u00D8-\u00F6] / [\u00F8-\u02FF] / [\u0370-\u037D] / [\u037F-\u1FFF] / [\u200C-\u200D] / [\u2070-\u218F] / [\u2C00-\u2FEF] / [\u3001-\uD7FF] / [\uF900-\uFDCF] / [\uFDF0-\uFFFD] /*TODO:last-range-fails: / [\u10000-\uEFFFF]*/ /*TODO:also-added-forbidden-chars:*/ / [-_]

PN_CHARS_U = PN_CHARS_BASE / '_'
PN_CHARS = PN_CHARS_U / '-' / [0-9] / '\u00B7' / [\u0300-\u036F] / [\u203F-\u2040]

PN_PREFIX =
    base:PN_CHARS_BASE+ other:((PN_CHARS / '.')* PN_CHARS)?
    {
        return base.join('') + (other? other.join('') : '');
    }

PN_LOCAL =
    chr:(PN_CHARS_U / ':' / [0-9] / PLX)
    other:(chars:(PN_CHARS / '.' / ':' / PLX)* last:(PN_CHARS / ':' / PLX) {
        return (chars? chars.join('') : '') + last;
    })?
    {
        return chr + (other? other.join('') : '');
    }

PLX = PERCENT / PN_LOCAL_ESC
PERCENT = '%' a:HEX b:HEX { return '%' + a + b; }
HEX = [0-9] / [A-F] / [a-f]
PN_LOCAL_ESC =
    '\\' chr:('_' / '~' / '.' / '-' / '!' / '$' / '&' / "'" / '(' / ')' / '*' / '+' / ',' / ';' / '=' / '/' / '?' / '#' / '@' / '%')
    {
        return chr;
    }

IGNORE =
    (WS / '#' [^\u000D\u000A]*[\u000D\u000A])*

/* vim: set ft=javascript sts=4 sw=4 sr : */
