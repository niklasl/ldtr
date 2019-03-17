export var DOMParser
export var XMLSerializer
export var randomBytes

if (typeof window === 'object') {
  DOMParser = window.DOMParser
  XMLSerializer = window.XMLSerializer
  randomBytes = function (i) { return window.crypto.getRandomValues(new Uint8Array(i)) }
}
