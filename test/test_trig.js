var trigParser = require('../lib/parsers/trig.js')

try {
  var result = trigParser.parse('\
  @prefix : <http://example.net/vocab/> . \n\
  @prefix ns: <http://example.com/ns/> . \n\
  PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> \n\
  base <http://example.org/> \n\
  \n\
  # a comment \n\
  <http://example.org/thing#it> a :Thing; # a type \n\
    :label "Just a Thing."@en-GB ; \n\
    :homepage <http://example.org/thing.html>; \n\
    :name "Thing"; \n\
    :date "1900"^^xsd:gYear; \n\
    :date "2000"^^xsd:gYear; \n\
    ns:def true, false ; :number -11 . \n\
  \n\
  </other> a :Thing . \n\
  \n\
  </some> :item [ :name "Blank 1" ] . \n\
  </more> :item [ :name "Blank 1.1" ], [ :name "Blank 1.2" ] . \n\
  \n\
  [] :name "Blank 2". \n\
  \n\
  [ :name "Blank 3" ] . \n\
  \n\
  _:blank :name "Blank 4". \n\
  \n\
  <items> :value (<one> "two" 3). \n\
  \n\
  ns:term a ns:Thing . \n\
  :term a ns:Term . \n\
  : a ns:Set . \n\
  ')
  console.log(JSON.stringify(result, null, 2))
} catch (e) {
  console.error(e.name, 'at', 'line:', e.line, 'column:', e.column, e.message)
  throw e;
}
