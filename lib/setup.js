import * as compat from './compat.js'

import * as xmldom from '@xmldom/xmldom'
compat.vars.DOMParser = xmldom.DOMParser
compat.vars.XMLSerializer = xmldom.XMLSerializer

import * as crypto from 'crypto'
compat.vars.randomBytes = function (i) { return crypto.randomBytes(i) }
compat.vars.createHash = function (algo) { return crypto.createHash(algo) }
