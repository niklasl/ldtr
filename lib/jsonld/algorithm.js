// <https://www.w3.org/TR/json-ld-api/>

const CONTEXT = '@context'
const BASE = '@base'
const VOCAB = '@vocab'
const LANGUAGE = '@language'
const ID = '@id'
const TYPE = '@type'
const VALUE = '@value'
const CONTAINER = '@container'
const SET = '@set'
const LIST = '@list'
const INDEX = '@index'
const GRAPH = '@graph'
const REVERSE = '@reverse'

let CONTEXT_KEYWORDS = {[BASE]: true, [VOCAB]: true, [LANGUAGE]: true}
let CONTAINER_KEYWORDS = {[LIST]: true, [SET]: true, [INDEX]: true, [LANGUAGE]: true}
let KEYWORDS = Object.assign({}, CONTEXT_KEYWORDS, CONTAINER_KEYWORDS,
  {[ID]: true, [TYPE]: true, [VALUE]: true, [CONTAINER]: true, [GRAPH]: true, [REVERSE]: true})

/*
dictionary JsonLdOptions {
    DOMString?             base;
    boolean                compactArrays = true;
    LoadDocumentCallback   documentLoader = null;
    (object? or DOMString) expandContext = null;
    DOMString              processingMode = "json-ld-1.0";
};
*/

/**
## 6.1 Context Processing Algorithm
This algorithm specifies how a new active context is updated with a local context.

The algorithm takes three input variables:
- an active context,
- a local context,
- and an array remote contexts which is used to detect cyclical context inclusions.

If remote contexts is not passed, it is initialized to an empty array.
*/
function processContext (activeContext = null, localContext = [], remoteContexts = {}, options = {}, documentIri = null) {
  // * Initialize result to the result of cloning active context.
  let result = activeContext ? clone(activeContext) : {}
  // * If local context is not an array, set it to an array containing only local context.
  if (!Array.isArray(localContext)) localContext = [localContext]
  // * For each item context in local context:
  for (let context of localContext) {
    // If context is null, set result to a newly-initialized active context and continue with the next context. The base IRI of the active context is set to the IRI of the currently being processed document (which might be different from the currently being processed context), if available; otherwise to null. If set, the base option of a JSON-LD API Implementation overrides the base IRI.
    if (context === null) {
      // TODO: why does null seem to mean "reset active"? // result = {}
      result.baseIri = options.base !== void 0 ? options.base : documentIri // TODO: why is this done in the null check?
      continue
    }

    // * If context is a string,
    if (typeof context === 'string') {
      // * Set context to the result of resolving value against the base IRI which is established as specified in section 5.1 Establishing a Base URI of [RFC3986]. Only the basic algorithm in section 5.2 of [RFC3986] is used; neither Syntax-Based Normalization nor Scheme-Based Normalization are performed. Characters additionally allowed in IRI references are treated in the same way that unreserved characters are treated in URI references, per section 6.5 of [RFC3987].
      context = resolveIri(activeContext.baseIri, context)
      // * If context is in the remote contexts array, a recursive context inclusion error has been detected and processing is aborted; otherwise, add context to remote contexts.
      if (remoteContexts[context]) throw new ContextException('recursive context inclusion')
      remoteContexts[context] = true
      // * Dereference context. If context cannot be dereferenced, a loading remote context failed error has been detected and processing is aborted.
      let contextDocument = dereference(context)
      if (contextDocument === null) throw new ContextException('loading remote context failed')
      // If the dereferenced document has no top-level JSON object with an @context member, an invalid remote context has been detected and processing is aborted; otherwise, set context to the value of that member.
      context = contextDocument[CONTEXT]
      if (context === void 0) throw new ContextException('invalid remote context')

      // * Set result to the result of [recursively calling this algorithm], passing result for active context, context for local context, and remote contexts.
      // * Continue with the next context.
      processContext(result, contextDocument, remoteContexts, options, documentIri)
    }

    // * If context is not a JSON object, an invalid local context error has been detected and processing is aborted.
    if (typeof context !== 'object') throw new ContextException('invalid local context')

    // * Create a JSON object defined to use to keep track of whether or not a term has already been defined or currently being defined during recursion.
    let defined = {}

    for (let key of Object.keys(context)) {
      let value = context[key]
      // * If context has an @base key and remote contexts is empty, i.e., the currently being processed context is not a remote context:
      if (key === BASE) {
        // * Initialize value to the value associated with the @base key.
        // * If value is null, remove the base IRI of result.
        if (value === null) result.base = null
        // * Otherwise, if value is an absolute IRI, the base IRI of result is set to value.
        // * Otherwise, if value is a relative IRI and the base IRI of result is not null,
        //   set the base IRI of result to the result of resolving value against the current base IRI of result.
        else if (typeof value === 'string') result.base = resolveIri(activeContext.baseIri, value)
        // * Otherwise, an invalid base IRI error has been detected and processing is aborted.
        else throw new ContextException('invalid base IRI', value)

      // * If context has an @vocab key:
      } else if (key === VOCAB) {
        // * Initialize value to the value associated with the @vocab key.
        // * If value is null, remove any vocabulary mapping from result.
        if (value === null) result.vocab = null
        // * Otherwise, if value is an absolute IRI or blank node identifier, the vocabulary mapping of result is set to value.
        // If it is not an absolute IRI or blank node identifier, an invalid vocab mapping error has been detected and processing is aborted.
        else if (typeof value === 'string') result.vocab = resolveIri(activeContext.baseIri, value)
        else throw new ContextException('invalid vocab mapping', value)

      // * If context has an @language key:
      } else if (key === LANGUAGE) {
        // * Initialize value to the value associated with the @language key.
        // * If value is null, remove any default language from result.
        if (value === null) result.defaultLanguage = null
        // * Otherwise, if value is string, the default language of result is set to lowercased value.
        // If it is not a string, an invalid default language error has been detected and processing is aborted.
        else if (typeof value === 'string') result.defaultLanguage = value.toLowerCase()
        else throw new ContextException('invalid default language', value)
      } else {
        // * For each key-value pair in context where key is not @base, @vocab, or @language,
        //   invoke the [Create Term Definition algorithm], passing result for active context, context for local context, key, and defined.
        createTermDefinition(result, context, key, defined)
      }
    }
  }

  // * Return result.
  return result
}

// ## 6.2 Create Term Definition
function createTermDefinition (activeContext, localContext, key, defined) {
  // The algorithm has four required inputs which are: an active context, a local context, a term, and a map defined.

  // If defined contains the key term and the associated value is true (indicating that the term definition has already been created), return.
  if (defined[key] === true) return
  // Otherwise, if the value is false, a cyclic IRI mapping error has been detected and processing is aborted.
  else if (defined[key] === false) throw new ContextException('cyclic IRI mapping', key)

  // Set the value associated with defined's term key to false. This indicates that the term definition is now being created but is not yet complete.
  defined[key] = false
  // Since keywords cannot be overridden, term must not be a keyword. Otherwise, a keyword redefinition error has been detected and processing is aborted.
  if (KEYWORDS[key]) throw new ContextException('keyword redefinition', key)

  // Remove any existing term definition for term in active context.
  delete activeContext[key]

  // Initialize value to a copy of the value associated with the key term in local context.
  let value = localContext[key]
  // If value is null or value is a JSON object containing the key-value pair @id-null, set the term definition in active context to null, set the value associated with defined's key term to true, and return.
  if (value === null || (typeof value === 'object' && value[ID] === null)) {
    activeContext[key] = null
    defined[key] = true
    return
  // Otherwise, if value is a string, convert it to a JSON object consisting of a single member whose key is @id and whose value is value.
  } else if (typeof value === 'string') {
    value = {[ID]: value}
  // Otherwise, value must be a JSON object, if not, an invalid term definition error has been detected and processing is aborted.
  } else if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ContextException('invalid term definition', key)
  }

  // Create a new term definition, definition.
  let definition = {}

  let id = value[ID]
  let type = value[TYPE]
  let rev = value[REVERSE]
  let container = value[CONTAINER]
  let language = value[LANGUAGE]

  // If value contains the key @type:
  // Initialize type to the value associated with the @type key, which must be a string.
  if (type) {
    // Otherwise, an invalid type mapping error has been detected and processing is aborted.
    if (typeof type !== 'string') throw new ContextException('invalid type mapping', type)

    // Set type to the result of using the IRI Expansion algorithm, passing active context, type for value, true for vocab, false for document relative, local context, and defined.
    let expanded = expandIri(activeContext, type, {vocab: true, documentRelative: false, localContext, defined})
    type = expanded
    // If the expanded type is neither @id, nor @vocab, nor an absolute IRI, an invalid type mapping error has been detected and processing is aborted.
    if (type !== ID && type !== VOCAB && !expanded) throw new ContextException('invalid type mapping')
    // Set the type mapping for definition to type.
    definition.type = type
  }

  // If value contains the key @reverse:
  if (rev) {
    // If value contains an @id, member, an invalid reverse property error has been detected and processing is aborted.
    if (id !== void 0) throw new ContextException('invalid reverse property', rev)
    // If the value associated with the @reverse key is not a string, an invalid IRI mapping error has been detected and processing is aborted.
    if (typeof rev !== 'string') throw new ContextException('invalid IRI mapping', rev)
    // Otherwise, set the IRI mapping of definition to the result of using the IRI Expansion algorithm, passing active context, the value associated with the @reverse key for value, true for vocab, false for document relative, local context, and defined.
    let expanded = expandIri(activeContext, rev, {vocab: true, documentRelative: false, localContext, defined})
    if (!expanded || expanded.indexOf(':') === -1) throw new ContextException('invalid IRI mapping', rev)
      // If the result is neither an absolute IRI nor a blank node identifier, i.e., it contains no colon (:), an invalid IRI mapping error has been detected and processing is aborted.
    definition.iri = expanded
    // If value contains an @container member, set the container mapping of definition to its value; if its value is neither @set, nor @index, nor null, an invalid reverse property error has been detected (reverse properties only support set- and index-containers) and processing is aborted.
    if (container !== void 0) {
      if (container !== SET && container !== INDEX && container !== null) throw new ContextException('invalid reverse property')
      definition.container = container
    }
    // Set the reverse property flag of definition to true.
    definition.reverse = true
    // Set the term definition of term in active context to definition and the value associated with defined's key term to true and return.
    activeContext[key] = definition
    defined[key] = true
    return
  }

  // Set the reverse property flag of definition to false.
  definition.reverse = false

  // If value contains the key @id and its value does not equal term:
  if (id !== void 0 && id !== key) {
    // If the value associated with the @id key is not a string, an invalid IRI mapping error has been detected and processing is aborted.
    if (typeof id !== 'string') throw new ContextException('invalid IRI mapping', key)
    // Otherwise, set the IRI mapping of definition to the result of using the IRI Expansion algorithm, passing active context, the value associated with the @id key for value, true for vocab, false for document relative, local context, and defined.
    let expanded = expandIri(activeContext, id, {vocab: true, documentRelative: false, localContext, defined})
    // If the resulting IRI mapping is neither a keyword, nor an absolute IRI, nor a blank node identifier, an invalid IRI mapping error has been detected and processing is aborted;
    if (!(KEYWORDS[expanded] || expanded.indexOf(':') > -1)) throw new ContextException('invalid IRI mapping', id)
    // if it equals @context, an invalid keyword alias error has been detected and processing is aborted.
    if (expanded === CONTEXT) throw new ContextException('invalid keyword alias', key)

    definition.iri = expanded

  // Otherwise if the term contains a colon (:):
  } else if (key.indexOf(':') > -1) {
    // If term is a compact IRI with a prefix that is a key in local context a dependency has been found. Use this algorithm recursively passing active context, local context, the prefix as term, and defined.
    let prefix = key.substring(0, key.indexOf(':'))
    createTermDefinition(activeContext, localContext, prefix, defined)
    // If term's prefix has a term definition in active context, set the IRI mapping of definition to the result of concatenating the value associated with the prefix's IRI mapping and the term's suffix.
    if (activeContext[prefix] !== void 0) {
      definition.iri = activeContext[prefix] + key.substring(key.indexOf(':') + 1)
    // Otherwise, term is an absolute IRI or blank node identifier. Set the IRI mapping of definition to term.
    } else {
      definition.iri = key
    }

  // Otherwise, if active context has a vocabulary mapping, the IRI mapping of definition is set to the result of concatenating the value associated with the vocabulary mapping and term.
  } else if (activeContext.vocab) {
    definition.iri = activeContext.vocab + key

  // If it does not have a vocabulary mapping, an invalid IRI mapping error been detected and processing is aborted.
  } else {
    throw new ContextException('invalid IRI mapping', key)
  }

  // If value contains the key @container:
  if (container) {
    // Initialize container to the value associated with the @container key, which must be either @list, @set, @index, or @language.
    // Otherwise, an invalid container mapping error has been detected and processing is aborted.
    if (!CONTAINER_KEYWORDS[container]) throw new ContextException('invalid container mapping', container)
    // Set the container mapping of definition to container.
    definition.container = container
  }

  // If value contains the key @language and does not contain the key @type:
  if (language !== void 0 && type === void 0) {
    // Initialize language to the value associated with the @language key, which must be either null or a string.
    // Otherwise, an invalid language mapping error has been detected and processing is aborted.
    if (typeof language !== 'string') throw new ContextException('invalid language mapping', language)
    // If language is a string set it to lowercased language. Set the language mapping of definition to language.
    definition.language = language.toLowerCase()
  }

  // Set the term definition of term in active context to definition and set the value associated with defined's key term to true.
  activeContext[key] = definition
  defined[key] = true
}

/*
## 6.3 IRI Expansion
The algorithm takes two required and four optional input variables.
The required inputs are:
- an active context and
- a value to be expanded.
The optional inputs are two flags,
- document relative and
- vocab,
that specifying whether value can be interpreted as a relative IRI against the document's base IRI or the active context's vocabulary mapping, respectively, and a local context and a map defined to be used when this algorithm is used during Context Processing.
If not passed, the two flags are set to false and local context and defined are initialized to null.
 */
function expandIri (activeContext, value, {vocab = false, documentRelative = false, localContext = null, defined = null}) {
  // If value is a keyword or null, return value as is.
  if (value === null || KEYWORDS[value]) return value
  // If local context is not null, it contains a key that equals value, and the value associated with the key that equals value in defined is not true, invoke the Create Term Definition algorithm, passing active context, local context, value as term, and defined. This will ensure that a term definition is created for value in active context during Context Processing.
  if (localContext && localContext[value] && !defined[localContext[value]]) {
    createTermDefinition(activeContext, localContext, value, defined)
  }
  // If vocab is true and the active context has a term definition for value, return the associated IRI mapping.
  if (vocab && activeContext[value]) return activeContext[value].iri

  // If value contains a colon (:), it is either an absolute IRI, a compact IRI, or a blank node identifier:
  let colonIdx = value.indexOf(':')
  if (colonIdx > -1) {
    // Split value into a prefix and suffix at the first occurrence of a colon (:).
    let prefix = value.substring(0, colonIdx)
    let suffix = value.substring(colonIdx + 1)
    // If prefix is underscore (_) or suffix begins with double-forward-slash (//), return value as it is already an absolute IRI or a blank node identifier.
    if (prefix === '_' || suffix.substring(0, 2) === '//') return value
    // If local context is not null, it contains a key that equals prefix, and the value associated with the key that equals prefix in defined is not true, invoke the Create Term Definition algorithm, passing active context, local context, prefix as term, and defined. This will ensure that a term definition is created for prefix in active context during Context Processing.
    if (localContext && localContext[prefix] && !defined[localContext[prefix]]) {
      createTermDefinition(activeContext, localContext, prefix, defined)
    }
    // If active context contains a term definition for prefix, return the result of concatenating the IRI mapping associated with prefix and suffix.
    if (activeContext[prefix]) {
      return activeContext[prefix].iri + suffix
    }
    // Return value as it is already an absolute IRI.
    return value
  }

  // If vocab is true, and active context has a vocabulary mapping, return the result of concatenating the vocabulary mapping with value.
  if (vocab && activeContext.vocab) {
    return activeContext.vocab + value

  // Otherwise, if document relative is true, set value to the result of resolving value against the base IRI.
  // Only the basic algorithm in section 5.2 of [RFC3986] is used; neither Syntax-Based Normalization nor Scheme-Based Normalization are performed. Characters additionally allowed in IRI references are treated in the same way that unreserved characters are treated in URI references, per section 6.5 of [RFC3987].
  } else if (documentRelative) {
    value = resolveIri(activeContext.baseIri, value)
  }

  // Return value as is.
  return value
}

/*
## 7.1 Expansion Algorithm
The algorithm takes three input variables:
- an active context,
- an active property,
- and an element to be expanded.
To begin, the active property is set to null, and element is set to the JSON-LD input.
 */
function expand (activeContext, element, activeProperty = null) {
  // 1) If element is null, return null.
  if (element === null) return null
  // 2) If element is a scalar,
  if (typeof element !== 'object') {
    // 2.1) If active property is null or @graph, drop the free-floating scalar by returning null.
    if (activeProperty === null || activeProperty === GRAPH) return null
    // 2.2) Return the result of the Value Expansion algorithm, passing the active context, active property, and element as value.
    return expandValue(activeContext, activeProperty, element)
  }
  // 3) If element is an array,
  if (Array.isArray(element)) {
    // 3.1) Initialize an empty array, result.
    let result = []
    // 3.2) For each item in element:
    for (let item of element) {
      // 3.2.1) Initialize expanded item to the result of using this algorithm recursively, passing active context, active property, and item as element.
      let expandedItem = expand(activeContext, item, activeProperty)
      let gotArray = Array.isArray(expandedItem)
      // 3.2.2) If the active property is @list or its container mapping is set to @list, the expanded item must not be an array or a list object, otherwise a list of lists error has been detected and processing is aborted.
      if (activeProperty === LIST ||
        (activeContext[activeProperty] && activeContext[activeProperty].container === LIST)) {
        if (gotArray || expandedItem[LIST] !== void 0) {
          throw new ContextException('list of lists')
        }
      }
      // 3.2.3) If expanded item is an array, append each of its items to result. Otherwise, if expanded item is not null, append it to result.
      if (gotArray) {
        for (let it of expandedItem) { result.push(it) }
      } else { result.push(expandedItem) }
    }
    // 3.3) Return result.
    return result
  }
  // 4) Otherwise element is a JSON object.
  // 5) If element contains the key @context, set active context to the result of the Context Processing algorithm, passing active context and the value of the @context key as local context.
  let localContext = element[CONTEXT]
  if (localContext !== void 0) {
    activeContext = processContext(activeContext, localContext)
  }
  // 6) Initialize an empty JSON object, result.
  let result = {}
  // 7) For each key and value in element, ordered lexicographically by key:
  for (let key in element) {
    // 7.1) If key is @context, continue to the next key.
    if (key === CONTEXT) {
      continue
    }
    let value = element[key]
    let valueIsArray = Array.isArray(value)
    let expandedValue
    // 7.2) Set expanded property to the result of using the IRI Expansion algorithm, passing active context, key for value, and true for vocab.
    let expandedProperty = expandIri(activeContext, key, {vocab: true})
    // 7.3) If expanded property is null or it neither contains a colon (:) nor it is a keyword, drop key by continuing to the next key.
    let expandedPropertyIsKeyword = KEYWORDS[expandedProperty]
    if (expandedProperty === null ||
        (expandedProperty.indexOf(':') === -1 && !expandedPropertyIsKeyword)) {
      continue
    }
    // 7.4) If expanded property is a keyword:
    if (expandedPropertyIsKeyword) {
      // 7.4.1) If active property equals @reverse, an invalid reverse property map error has been detected and processing is aborted.
      if (activeProperty === REVERSE) throw new ContextException('invalid reverse property map')
      // 7.4.2) If result has already an expanded property member, an colliding keywords error has been detected and processing is aborted.
      if (result[expandedProperty] !== void 0) throw new ContextException('colliding keywords')
      // 7.4.3) If expanded property is @id and value is not a string, an invalid @id value error has been detected and processing is aborted. Otherwise, set expanded value to the result of using the IRI Expansion algorithm, passing active context, value, and true for document relative.
      if (expandedProperty === ID) {
        if (typeof value !== 'string') throw new ContextException('invalid @id value')
        expandedValue = expandIri(activeContext, value, {documentRelative: true})
      // 7.4.4) If expanded property is @type and value is neither a string nor an array of strings, an invalid type value error has been detected and processing is aborted. Otherwise, set expanded value to the result of using the IRI Expansion algorithm, passing active context, true for vocab, and true for document relative to expand the value or each of its items.
      } else if (expandedProperty === TYPE) {
        if (!(typeof value === 'string' || (valueIsArray && value.every(it => typeof it === 'string')))) {
          throw new ContextException('invalid @id value')
        }
        let opts = {vocab: true, documentRelative: true}
        expandedValue = valueIsArray
          ? value.map(it => expandIri(activeContext, it, opts))
          : expandIri(activeContext, value, opts)
      // 7.4.5) If expanded property is @graph, set expanded value to the result of using this algorithm recursively passing active context, @graph for active property, and value for element.
      } else if (expandedProperty === GRAPH) {
        expandedValue = expand(activeContext, value, GRAPH)
      // 7.4.6) If expanded property is @value and value is not a scalar or null, an invalid value object value error has been detected and processing is aborted. Otherwise, set expanded value to value. If expanded value is null, set the @value member of result to null and continue with the next key from element. Null values need to be preserved in this case as the meaning of an @type member depends on the existence of an @value member.
      } else if (expandedProperty === VALUE) {
        if (value === null || typeof value === 'object') throw new ContextException('invalid value object')
        expandedValue = value
        if (expandedValue === null) {
          result[VALUE] = null
          continue
        }
      // 7.4.7) If expanded property is @language and value is not a string, an invalid language-tagged string error has been detected and processing is aborted. Otherwise, set expanded value to lowercased value.
      } else if (expandedProperty === LANGUAGE) {
        if (typeof value !== 'string') throw new ContextException('invalid language-tagged string')
        expandedValue = value.toLowerCase()
      // 7.4.8) If expanded property is @index and value is not a string, an invalid @index value error has been detected and processing is aborted. Otherwise, set expanded value to value.
      } else if (expandedProperty === INDEX) {
        if (typeof value !== 'string') throw new ContextException('invalid @index value')
        expandedValue = value
      // 7.4.9) If expanded property is @list:
      } else if (expandedProperty === LIST) {
        // 7.4.9.1) If active property is null or @graph, continue with the next key from element to remove the free-floating list.
        if (activeProperty === null || activeProperty === GRAPH) continue
        // 7.4.9.2) Otherwise, initialize expanded value to the result of using this algorithm recursively passing active context, active property, and value for element.
        expandedValue = expand(activeContext, value, activeProperty)
        // 7.4.9.3) If expanded value is a list object, a list of lists error has been detected and processing is aborted.
        if (expandedValue[LIST] !== void 0) throw new ContextException('list of lists', expandedValue)
      // 7.4.10) If expanded property is @set, set expanded value to the result of using this algorithm recursively, passing active context, active property, and value for element.
      } else if (expandedProperty === SET) {
        expandedValue = expand(activeContext, value, activeProperty)
      // 7.4.11) If expanded property is @reverse and value is not a JSON object, an invalid @reverse value error has been detected and processing is aborted. Otherwise
      } else if (expandedProperty === REVERSE) {
        if (typeof value !== 'object') throw new ContextException('invalid @reverse value')
        // 7.4.11.1) Initialize expanded value to the result of using this algorithm recursively, passing active context, @reverse as active property, and value as element.
        expandedValue = expand(activeContext, value, REVERSE)
        // 7.4.11.2) If expanded value contains an @reverse member, i.e., properties that are reversed twice, execute for each of its property and item the following steps:
        let twiceReversed = expandedValue[REVERSE]
        if (twiceReversed !== void 0) {
          for (let property in twiceReversed) {
            // 7.4.11.2.1) If result does not have a property member, create one and set its value to an empty array.
            if (result[property] === void 0) result[property] = []
            // 7.4.11.2.2) Append item to the value of the property member of result.
            result[property].push(twiceReversed[property])
          }
        }
        // 7.4.11.3) If expanded value contains members other than @reverse:
        let nonReverseKeys = Object.keys(expandedValue).filter(it => it !== REVERSE)
        if (nonReverseKeys.length > 0) {
          // 7.4.11.3.1) If result does not have an @reverse member, create one and set its value to an empty JSON object.
          if (result[REVERSE] === void 0) result[REVERSE] = {}
          // 7.4.11.3.2) Reference the value of the @reverse member in result using the variable reverse map.
          let reverseMap = result[REVERSE]
          // 7.4.11.3.3) For each property and items in expanded value other than @reverse:
          for (let property of nonReverseKeys) {
            // 7.4.11.3.3.1) For each item in items:
            for (let item of expandedValue[property]) {
              // 7.4.11.3.3.1.1) If item is a value object or list object, an invalid reverse property value has been detected and processing is aborted.
              if (item[VALUE] !== void 0 || item[LIST] !== void 0) {
                throw new ContextException('invalid reverse property value')
              }
              // 7.4.11.3.3.1.2) If reverse map has no property member, create one and initialize its value to an empty array.
              if (reverseMap[property] === void 0) reverseMap[property] = []
              // 7.4.11.3.3.1.3) Append item to the value of the property member in reverse map.
              reverseMap[property].push(item)
            }
          }
        }
        // 7.4.11.4) Continue with the next key from element.
        continue
      }
      // 7.4.12) Unless expanded value is null, set the expanded property member of result to expanded value.
      if (expandedValue !== null) {
        result[expandedProperty] = expandedValue
      }
      // 7.4.13) Continue with the next key from element.
      continue
    }
    let definition = activeContext[key] || {}
    // 7.5) Otherwise, if key's container mapping in active context is @language and value is a JSON object then value is expanded from a language map as follows:
    if (definition.container === LANGUAGE && typeof value === 'object') {
      // 7.5.1) Initialize expanded value to an empty array.
      expandedValue = []
      // 7.5.2) For each key-value pair language-language value in value, ordered lexicographically by language:
      for (let lang in value) {
        let langValue = value[lang]
        // 7.5.2.1) If language value is not an array set it to an array containing only language value.
        if (!Array.isArray(langValue)) langValue = [langValue]
        // 7.5.2.2) For each item in language value:
        for (let item of langValue) {
          // 7.5.2.2.1) item must be a string, otherwise an invalid language map value error has been detected and processing is aborted.
          if (typeof item !== 'string') throw new ContextException('invalid language map value')
          // 7.5.2.2.2) Append a JSON object to expanded value that consists of two key-value pairs: (@value-item) and (@language-lowercased language).
          expandedValue.push({[VALUE]: item, [LANGUAGE]: lang.toLowerCase()})
        }
      }
    // 7.6) Otherwise, if key's container mapping in active context is @index and value is a JSON object then value is expanded from an index map as follows:
    } else if (definition.container === INDEX && typeof value === 'object') {
      // 7.6.1) Initialize expanded value to an empty array.
      expandedValue = []
      // 7.6.2) For each key-value pair index-index value in value, ordered lexicographically by index:
      for (let indexKey in value) {
        // 7.6.2.1) If index value is not an array set it to an array containing only index value.
        let indexValue = value[indexKey]
        if (!Array.isArray(indexValue)) indexValue = [indexValue]
        // 7.6.2.2) Initialize index value to the result of using this algorithm recursively, passing active context, key as active property, and index value as element.
        indexValue = expand(activeContext, indexValue, key)
        // 7.6.2.3) For each item in index value:
        for (let item of indexValue) {
          // 7.6.2.3.1) If item does not have the key @index, add the key-value pair (@index-index) to item.
          if (item[INDEX] === void 0) item[INDEX] = indexKey
          // 7.6.2.3.2) Append item to expanded value.
          expandedValue.push(item)
        }
      }
    // 7.7) Otherwise, initialize expanded value to the result of using this algorithm recursively, passing active context, key for active property, and value for element.
    } else {
      expandedValue = expand(activeContext, value, key)
    }
    // 7.8) If expanded value is null, ignore key by continuing to the next key from element.
    if (expandedValue === null) continue
    // 7.9) If the container mapping associated to key in active context is @list and expanded value is not already a list object, convert expanded value to a list object by first setting it to an array containing only expanded value if it is not already an array, and then by setting it to a JSON object containing the key-value pair @list-expanded value.
    if (definition.container === LIST) {
      if (!Array.isArray(expandedValue)) expandedValue = [expandedValue]
      expandedValue = {[LIST]: expandedValue}
    // 7.10) Otherwise, if the term definition associated to key indicates that it is a reverse property
    } else if (definition.reverse) {
      // 7.10.1) If result has no @reverse member, create one and initialize its value to an empty JSON object.
      if (result[REVERSE] === void 0) result[REVERSE] = {}
      // 7.10.2) Reference the value of the @reverse member in result using the variable reverse map.
      let reverseMap = result[REVERSE]
      // 7.10.3) If expanded value is not an array, set it to an array containing expanded value.
      if (!Array.isArray(expandedValue)) expandedValue = [expandedValue]
      // 7.10.4) For each item in expanded value
      for (let item of expandedValue) {
        // 7.10.4.1) If item is a value object or list object, an invalid reverse property value has been detected and processing is aborted.
        if (item[VALUE] !== void 0 || item[LIST] !== void 0) throw new ContextException('invalid reverse property value')
        // 7.10.4.2) If reverse map has no expanded property member, create one and initialize its value to an empty array.
        if (reverseMap[expandedProperty] === void 0) reverseMap[expandedProperty] = []
        // 7.10.4.3) Append item to the value of the expanded property member of reverse map.
        reverseMap[expandedProperty].push(item)
      }
    // 7.11) Otherwise, if key is not a reverse property:
    } else {
      // 7.11.1) If result does not have an expanded property member, create one and initialize its value to an empty array.
      if (result[expandedProperty] === void 0) result[expandedProperty] = []
      // 7.11.2) Append expanded value to value of the expanded property member of result.
      // TODO: is this missing from algorithm or is something wrong above?
      if (Array.isArray(expandedValue)) {
        for (let member of expandedValue) {
          result[expandedProperty].push(member)
        }
      } else {
        result[expandedProperty].push(expandedValue)
      }
    }
  }
  let resultKeys = Object.keys(result)
  // 8) If result contains the key @value:
  if (result[VALUE] !== void 0) {
    // 8.1) The result must not contain any keys other than @value, @language, @type, and @index. It must not contain both the @language key and the @type key. Otherwise, an invalid value object error has been detected and processing is aborted.
    let otherKeys = resultKeys.filter(it =>
      it !== VALUE && it !== LANGUAGE && it !== TYPE && it !== INDEX)
    if ((result[LANGUAGE] !== void 0 && result[TYPE] !== void 0) || otherKeys.length) {
      throw new ContextException('invalid value object', result)
    }
    // 8.2) If the value of result's @value key is null, then set result to null.
    if (result[VALUE] === null) {
      result = null
    // 8.3) Otherwise, if the value of result's @value member is not a string and result contains the key @language, an invalid language-tagged value error has been detected (only strings can be language-tagged) and processing is aborted.
    } else if (typeof result[VALUE] !== 'string' && result[LANGUAGE] !== void 0) {
      throw new ContextException('invalid language-tagged value')
    // 8.4) Otherwise, if the result has an @type member and its value is not an IRI, an invalid typed value error has been detected and processing is aborted.
    } else if (result[TYPE] !== void 0 && result[TYPE].indexOf(':') === -1) {
      throw new ContextException('invalid typed value')
    }
  // 9) Otherwise, if result contains the key @type and its associated value is not an array, set it to an array containing only the associated value.
  } else if (result[TYPE] !== void 0 && !Array.isArray(result[TYPE])) {
    result[TYPE] = [result[TYPE]]
  // 10) Otherwise, if result contains the key @set or @list:
  } else if (result[SET] !== void 0 || result[LIST] !== void 0) {
    // 10.1) The result must contain at most one other key and that key must be @index. Otherwise, an invalid set or list object error has been detected and processing is aborted.
    if (resultKeys.length > 2 || (resultKeys.length > 1 && resultKeys[INDEX] === void 0)) {
      throw new ContextException('invalid ' + (result[SET] ? 'set' : 'list') + ' object', result)
    }
    // 10.2) If result contains the key @set, then set result to the key's associated value.
    if (result[SET] !== void 0) {
      result = result[SET]
    }
  }
  // 11) If result contains only the key @language, set result to null.
  if (resultKeys.length === 1 && resultKeys[LANGUAGE] !== void 0) {
    result = null
  }
  // 12) If active property is null or @graph, drop free-floating values as follows:
  if (activeProperty === null || activeProperty === GRAPH) {
    // 12.1) If result is an empty JSON object or contains the keys @value or @list, set result to null.
    if (resultKeys.length === 0 || resultKeys[VALUE] !== void 0 || resultKeys[LIST] !== void 0) {
      result = null
    // 12.2) Otherwise, if result is a JSON object whose only key is @id, set result to null.
    } else if (resultKeys.length === 1 && resultKeys[ID] !== void 0) {
      result = null
    }
  }
  // 13) Return result.
  return result
}

/*
## 7.2 Value Expansion

The algorithm takes three required inputs:
- an active context,
- an active property,
- and a value to expand.
 */
function expandValue (activeContext, activeProperty, value) {
  let definition = activeContext[activeProperty] || {}
  // 1) If the active property has a type mapping in active context that is @id, return a new JSON object containing a single key-value pair where the key is @id and the value is the result of using the IRI Expansion algorithm, passing active context, value, and true for document relative.
  if (definition.type === ID) {
    return {[ID]: expandIri(activeContext, value, {documentRelative: true})}
  }
  // 2) If active property has a type mapping in active context that is @vocab, return a new JSON object containing a single key-value pair where the key is @id and the value is the result of using the IRI Expansion algorithm, passing active context, value, true for vocab, and true for document relative.
  if (definition.type === VOCAB) {
    return {[ID]: expandIri(activeContext, value, {vocab: true, documentRelative: true})}
  }
  // 3) Otherwise, initialize result to a JSON object with an @value member whose value is set to value.
  let result = {[VALUE]: value}
  // 4) If active property has a type mapping in active context, add an @type member to result and set its value to the value associated with the type mapping.
  if (definition.type !== void 0) {
    result[TYPE] = definition.type
  // 5) Otherwise, if value is a string:
  } else {
    // 5.1) If a language mapping is associated with active property in active context, add an @language to result and set its value to the language code associated with the language mapping; unless the language mapping is set to null in which case no member is added.
    if (definition.language != null) {
      result[LANGUAGE] = definition.language
    // 5.2) Otherwise, if the active context has a default language, add an @language to result and set its value to the default language.
    } else if (activeContext.defaultLanguage != null) {
      result[LANGUAGE] = activeContext.defaultLanguage
    }
  }
  // 6) Return result.
  return result
}

class ContextException {
  constructor (msg, data = null) {
    this.msg = msg
    this.data = data
  }
  toString () {
    let msg = this.msg
    if (this.data) {
      msg += ': ' + (this.data === 'string'
        ? this.data
        : JSON.stringify(this.data))
    }
    return msg
  }
}

function resolveIri (baseIri, iri) {
  // TODO: IMPLEMENT
  return iri
}

function dereference (iri) {
  // TODO: IMPLEMENT (async)
  return {}
}

function clone (o) {
  let O = function () {}
  O.prototype = o
  return new O()
}

module.exports = {
  CONTEXT,
  BASE,
  VOCAB,
  LANGUAGE,
  ID,
  TYPE,
  VALUE,
  CONTAINER,
  SET,
  LIST,
  INDEX,
  GRAPH,
  REVERSE,
  processContext,
  expandIri,
  expand,
  expandValue
}
