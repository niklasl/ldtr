# LDTR

*A [Linked Data](http://linkeddata.org/) Transcriber.*

----

* [Intro](#intro)
* [Install](#install)
* [Command Line](#command-line)
* [Supported Formats](#supported-formats)
* [Code](#code)

----

## Intro

LDTR turns various representations of
[RDF](https://www.w3.org/TR/rdf11-primer/)
into
[JSON-LD](http://www.w3.org/TR/json-ld/).

This is done by transcribing the syntax verbatim into a valid JSON-LD structure
that represents the same RDF. **Only use output from this tool directly when
input is strictly under your control.** In any other case, you need to pass the
result through a JSON-LD processor (such as
[jsonld.js](https://github.com/digitalbazaar/jsonld.js)) in order to to have
control over the shapes and terms of the results.

RDF is about meaning, not structure. Of course, meaning is always – indirectly
but intrinsically – conveyed by structure. And if the structure is yours to
begin with, you can leverage its shape directly for speed and convenience. As
such, the practise of using JSON-LD as plain JSON is a bit like using C. Very
effective and close to the metal, but rather dangerous if you don't know what
you're doing.

To a certain point, this tool can be used as a teaching aid, for showing the
isomorphisms of different RDF serializations. Note that prefix mechanisms
(QNames/CURIEs/PNames) are basically only useful in RDF syntaxes for
*authoring*. They are not intended to be consumed directly, syntactically, from
the source. Thus, by producing a JSON-LD compliant semi-compact transcript like
LDTR does, consumers who are unaware of what the tokens really mean (in RDF)
may be misled to consider them fixed and atomic, instead of the locally defined
shorthand forms they really are. This is why this form can only be trusted when
you are in control of the source data.

## Install

    $ npm install ldtr

## Command Line

    $ ldtr RDF_FILE_OR_URL

Or:

    $ cat TURTLE_FILE | ldtr

## Supported Formats

* [TriG](https://www.w3.org/TR/trig/) (and its subsets
  [Turtle](https://www.w3.org/TR/turtle/) and
  [N-Triples](https://www.w3.org/TR/n-triples/)).

* [RDFa 1.1](https://www.w3.org/TR/rdfa-primer/) embedded in HTML.

* All the old [RDF/XML](https://www.w3.org/TR/rdf-syntax-grammar/) out there on
  the web.


The TriG parser is generated from a grammar file (based on the
[TriG W3C EBNF Grammar](http://www.w3.org/TR/trig/#sec-grammar)) using
[PEG.js](http://pegjs.org/).

## Code

The API of this library isn't finalized yet. It strives to provide set of
simple and independent modules, which should be usable both from the browser
and on the server (e.g NodeJS).

For text-based formats, the input is expected to be a regular string. For XML-
and HTML-based formats, the input should be a DOM Document. (Any W3C XML DOM
Level 2 Core compliant DOMParser and XMLSerializer will do. For Node and CLI
usage, LDTR uses [xmldom](https://github.com/jindw/xmldom).)

Parsing TriG:

```javascript
var trigParser = require('ldtr/lib/trig/parser');
var jsonld = trigParser.parse('<a> :b "c" .');
```

Parsing RDFa:

```javascript
var rdfaParser = require('ldtr/lib/rdfa/parser');
var doc = new DOMParser().parseFromString(xmlStr, 'text/html');
var jsonld = rdfaParser.parse(doc, baseUri, {compact: true});
```

Parsing RDF/XML:

```javascript
var rdfxmlParser = require('ldtr/lib/rdfxml/parser');
var doc = new DOMParser().parseFromString(rdfStr, 'text/xml');
var jsonld = rdfxmlParser.parse(doc);
```
