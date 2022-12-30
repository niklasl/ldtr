import * as compat from './compat.js'

import * as xmldom from '@xmldom/xmldom'
compat.DOMParser = xmldom.DOMParser
compat.XMLSerializer = xmldom.XMLSerializer

import * as crypto from 'crypto'
compat.randomBytes = function (i) { return crypto.randomBytes(i) }
compat.createHash = function (algo) { return crypto.createHash(algo) }
