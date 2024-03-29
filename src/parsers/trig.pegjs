/**
 * A PEG.js <http://pegjs.org/> Grammar File for TriG <http://www.w3.org/TR/trig/#sec-grammar>.
 */

{

    const PNAME_TAG = "_:neverspace.net,2016-01-10:ldtr:pname";

    const TYPE = '@type';
    const ANNOTATION = '@annotation';
    const ANNOTATED_TYPE_KEY = '@set'; // TYPE // '@index'
    const TYPEANNOTATION = null;//'@type@annotation';
    const KEEP_REDUNDANT_ANNOTATED_TYPE = false; // true;
    const TYPEANNOTATION_DECL = {
        [TYPEANNOTATION]: {
            "@id": TYPE,
            "@container": "@annotation"
        }
    };
    //const ANNOTATED_OBJECTS_KEY = '@object';

    const TRIPLE_KEY = '@id';

    function assign(target, source) {
        for (var key in source) {
            target[key] = source[key];
        }
        return target;
    }

    function isEmptyObject(o) {
        for (let k in o) {
            if (o.hasOwnProperty(k)) return false;
        }
        return true;
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

    function toPair(verb, objectList) {
        if (verb === TYPE) return toTypePair(objectList);

        var po = {};
        po[verb] = objectList;
        return po;
    }

    function toTypePair(objectList) {
        function reducePname(o) {
            if (typeof o === 'object') {
                /*
                if (ANNOTATED_OBJECTS_KEY &&
                    ANNOTATED_OBJECTS_KEY in o &&
                    '@id' in o[ANNOTATED_OBJECTS_KEY]) {
                    o[ANNOTATED_OBJECTS_KEY] = o[ANNOTATED_OBJECTS_KEY]['@id']
                } else
                */
                if ('@id' in o) {
                    if (ANNOTATION in o) {
                        o = {
                            [ANNOTATED_TYPE_KEY]: o['@id'],
                            [ANNOTATION]: o[ANNOTATION]
                        }
                    } else {
                        o = o['@id']
                    }
                }
                // TODO: if value is an actual (b)node object, item need to use
                // rdf:type as key for those values instead of @type.
            }
            return o
        }

        let isObjectArray = Array.isArray(objectList)
        if (!isObjectArray) {
            objectList = [objectList]
        }

        let plain = [];
        let annotated = {};
        let anyannot = false;

        for (let o of objectList) {
            let reduced = reducePname(o);
            if (typeof reduced === 'object' && TYPEANNOTATION) {
                anyannot = true;
                let typevalue = reduced[ANNOTATED_TYPE_KEY];
                annotated[typevalue] = reduced[ANNOTATION];
                if (KEEP_REDUNDANT_ANNOTATED_TYPE) {
                    plain.push(typevalue);
                }
            } else {
                plain.push(reduced);
            }
        }

        let typepair = {};
        if (plain.length > 0) {
            typepair[TYPE] = !isObjectArray ? plain[0] : plain;
        }
        if (anyannot) {
            typepair['@context'] = TYPEANNOTATION_DECL
            typepair[TYPEANNOTATION] = annotated;
        }

        return typepair;
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
                        existing = existing.concat(value);
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

    function packAnnotation (object, annotation) {
        if (annotation == null) {
            return object
        }
        /*
        if (ANNOTATED_OBJECTS_KEY) {
            annotation[ANNOTATED_OBJECTS_KEY] = object
            return annotation
        }
        */
        if (typeof object !== 'object') {
            object = {'@value': object, [ANNOTATION]: annotation}
        } else {
            object[ANNOTATION] = annotation
        }
        return object
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
    IGNORE chunk:((directive / block) IGNORE)*
    {
        var currentContext = {}, currentGraph = [];
        var result = [
            {'@context': currentContext, '@graph': currentGraph}
        ];
        var vocab = '';

        function cleanupPNameTags(item, vocab) {
            var id = item['@id'];
            if (item[PNAME_TAG]) {
                delete item[PNAME_TAG];
                if (id === null) {
                    item['@id'] = vocab;
                } else if (id.indexOf(':') === -1) {
                    item['@id'] = vocab + id;
                }
            }
            for (var key in item) {
                var o = item[key];
                if (typeof o === 'object') {
                    cleanupPNameTags(o, vocab);
                }
            }
        }

        for (let [item, ws] of chunk) {
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
                vocab = currentContext['@vocab'] || '';

                delete item['@context'];
                if (isEmptyObject(item)) {
                    continue
                }
            }

            if (Array.isArray(item)) {
                currentGraph.push.apply(currentGraph, item);
            } else {
                cleanupPNameTags(item, vocab);
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
                                 pos:predicateObjectList IGNORE '.' { return pos; } ) {
        if (typeof labelled['@graph'] !== 'undefined') {
            return assign(subject, labelled);
        } else {
            return reducePairs(subject, labelled);
        }
    } / quoted:quotedTriple IGNORE pos:predicateObjectList IGNORE '.' {
        return reducePairs(quoted, pos)
    }

triples2 =
    bnpairs:blankNodePropertyList pos:predicateObjectList? IGNORE '.'
    {
        return pos? reducePairs(bnpairs, pos) : bnpairs;
    }
    / collection:collection pos:predicateObjectList IGNORE '.'
    {
        return pos? reducePairs(collection, pos) : collection;
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
        var po = toPair(verb, objectList);
        var pairs = [po];
        for (var pair of rest) {
            if (pair === null) // last ';', so we could also break
                continue
            let [rTerm, rList] = pair;
            po = toPair(rTerm, rList);
            pairs.push(po);
        }
        return pairs;
    }

objectList =
    //first:object remainder:(IGNORE ',' IGNORE  object:object { return object; } )*
    first:(object:object IGNORE annotation:annotation? { return packAnnotation(object, annotation) })
    remainder:(IGNORE ',' IGNORE
               annotated:(object:object IGNORE annotation:annotation? { return packAnnotation(object, annotation) }) { return annotated })*
    {
        if (remainder.length > 0) {
            var objects = [first];
            for (var annotated of remainder) {
                objects.push(annotated);
            }
            return objects;
        } else {
            return first;
        }
    }

verb =
    IGNORE verb:(predicate / 'a' {return TYPE; } ) IGNORE
    {
        return typeof verb === 'object' ? verb['@id'] || '' : verb;
    }

subject = iri / blank / quotedTriple
predicate = iri
object = iri / blank / blankNodePropertyList / literal / quotedTriple

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

quotedTriple = IGNORE '<<' IGNORE s:qtSubject IGNORE p:verb IGNORE o:qtObject IGNORE '>>' IGNORE {
    let obj = reducePairs(s, [toPair(p, o)])
    return { '@id': obj }
}

qtSubject = iri / BlankNode / quotedTriple
qtObject = iri / BlankNode / literal / quotedTriple

annotation =
    IGNORE '{|' pos:predicateObjectList '|}' IGNORE
    {
        return reducePairs({}, pos);
    }

// NOTE: PEG.js needed reversed match order
NumericLiteral =
    DOUBLE / DECIMAL / INTEGER

RDFLiteral =
    rdfliteral: String tag:(LANGTAG /
                            '^^' datatype:iri { return {[TYPE]: datatype['@id']}; } )?
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

PrefixedName = pname:(PNAME_LN / PNAME_NS) {
    var item = {"@id": pname};
    item[PNAME_TAG] = true;
    return item;
}

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

PNAME_LN = ns:PNAME_NS l:PN_LOCAL
    {
        return (ns === null? '' : ns + ':') + l;
    }

BLANK_NODE_LABEL =
    lead:'_:'
    first:(PN_CHARS_U / [0-9])
    //((PN_CHARS / '.')* PN_CHARS)? // PEG needs:
    rest:(chars:('.' PN_CHARS) { return chars.join(''); } / PN_CHARS) *
    {
        var label = first + (rest? rest.join('') : '');
        return {'@id': lead + label};
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

PN_CHARS_BASE = [A-Z] / [a-z] / [\u00C0-\u00D6] / [\u00D8-\u00F6] / [\u00F8-\u02FF] / [\u0370-\u037D] / [\u037F-\u1FFF] / [\u200C-\u200D] / [\u2070-\u218F] / [\u2C00-\u2FEF] / [\u3001-\uD7FF] / [\uF900-\uFDCF] / [\uFDF0-\uFFFD] /*TODO:last-range-fails: / [\u10000-\uEFFFF]*/

PN_CHARS_U = PN_CHARS_BASE / '_'
PN_CHARS = PN_CHARS_U / '-' / [0-9] / '\u00B7' / [\u0300-\u036F] / [\u203F-\u2040]

PN_PREFIX =
    first:PN_CHARS_BASE
    //((PN_CHARS / '.')* PN_CHARS)? // PEG needs:
    rest:(chars:('.' PN_CHARS) { return chars.join(''); } / PN_CHARS) *
    {
        return first + (rest? rest.join('') : '');
    }

PN_LOCAL =
    first:(PN_CHARS_U / ':' / [0-9] / PLX)
    //((PN_CHARS / '.' / ':' / PLX)* (PN_CHARS / ':' / PLX))? // PEG needs:
    rest:(chars:((PN_CHARS / '.' / ':' / PLX)
            (PN_CHARS / ':' / PLX)) { return chars.join(''); }
           / (PN_CHARS / ':' / PLX))*
    {
        return first + (rest? rest.join('') : '');
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
