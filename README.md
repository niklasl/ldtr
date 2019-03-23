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

LDTR works by *transcribing* the input syntax verbatim into a valid JSON-LD
structure that represents the same RDF. **Only use output from this tool
directly when input is strictly under your control.** In any other case, LDTR
includes a JSON-LD expansion implementation, to turn the data into a
normalized, fully predicable RDF data representation. Use this if you want to
use LDTR for general RDF data processing.

This tool strives to be usable both in the browser, on the command line and on
the server (mainly NodeJS). It is built using modern JS and ES modules, along
with some minimal provisioning for different runtimes.

## Supported Input Formats

* [TriG](https://www.w3.org/TR/trig/) (and its subsets
  [Turtle](https://www.w3.org/TR/turtle/) and
  [N-Triples](https://www.w3.org/TR/n-triples/)).

* [RDFa 1.1](https://www.w3.org/TR/rdfa-primer/) embedded in HTML.

* All the old [RDF/XML](https://www.w3.org/TR/rdf-syntax-grammar/) out there on
  the web.

## Output Forms and Formats

For flexible compact JSON-LD, you can, and often should, also pass the result
through a JSON-LD processor (such as
[jsonld.js](https://github.com/digitalbazaar/jsonld.js)) in order to to have
control over the shapes and terms of the results.

While primarily designed to produce a native data structure representable as
JSON-LD, LDTR also includes TriG serializer, which similarly works by
transcribing the JSON-LD as simply as possible. This imposes some restrictions
upon the data, due to which advanced features of JSON-LD LDTR can faithfully
transcribe. (You can always feed it expanded JSON-LD to ensure compatibility
and fidelity.)

## Install

    $ npm install ldtr

## Command Line Usage

    $ ldtr RDF_FILE_OR_URL

    $ cat TURTLE_FILE | ldtr

    $ cat RDFA_FILE | ldtr -t html

    $ ldtr RDF_FILE_OR_URL -o trig

    $ ldtr -h

## Library Usage

Use the top level interface: `read` and `write`, with input data, and
optionally a media type if it isn't "obvious" (e.g. a DOM Document, an URL or a
file with a common suffix).

For text-based formats, the input is expected to be a regular string. For XML-
and HTML-based formats, the input can also be a DOM Document. (Any W3C XML DOM
Level 2 Core compliant DOMParser and XMLSerializer will do.

Parsing:

```javascript
import * as ldtr from 'ldtr'

let data

// Guess type by suffix
data = await ldtr.read('some-data.trig')

// Supply file path and type
data = await ldtr.read('some-data.trig', 'text/trig')

// Supply URL and use respone content-type
data = await ldtr.read('http://www.w3.org/1999/02/22-rdf-syntax-ns')

// Supply URL and type
data = await ldtr.read('http://example.org', 'text/trig')

// Supply data and type
data = await ldtr.read({ data: '<a> :b "c" .', type: 'text/turtle' })

// Parse RDF/XML from a DOMDocument
doc = new DOMParser().parseFromString(rdfStr, 'text/xml')
data = await ldtr.read({data: doc})

// Parse RDFa from a DOMDocument
doc = new DOMParser().parseFromString(rdfStr, 'text/html')
data = await ldtr.read({data: doc})
```

## Internals

The TriG parser is generated from a grammar file (based on the
[TriG W3C EBNF Grammar](http://www.w3.org/TR/trig/#sec-grammar)) using
[PEG.js](http://pegjs.org/).

By default on Node e.g. when using the CLI, LDTR uses
[xmldom](https://github.com/jindw/xmldom) for HTML and XML parsing.

## Rationale

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

