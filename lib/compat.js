export let vars = {
  DOMParser: null,
  XMLSerializer: null,
  randomBytes: null,
  createHash: null,
}

if (typeof window === 'object') {
  DOMParser = window.DOMParser
  XMLSerializer = window.XMLSerializer
  randomBytes = function (i) { return window.crypto.getRandomValues(new Uint8Array(i)) }
  createHash = function (algo) { return window.crypto.createHash(algo) }
}
