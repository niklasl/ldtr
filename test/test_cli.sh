#!/bin/bash

ldtr test/data/lotr.ttl -e

cat test/data/very_compact.jsonld | ldtr -t jsonld -e

echo '
<article typeof="foaf:Person">
<p property="foaf:name">Some Body</p>
</article>
' | ldtr -t html

echo '
<foaf:Person
    xmlns:foaf="http://xmlns.com/foaf/0.1/">
    <foaf:name>Some Body</foaf:name>
</foaf:Person>
' | ldtr -t rdf
