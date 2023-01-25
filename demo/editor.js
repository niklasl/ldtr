import {readSource} from '../lib/xhtreqreader.js'
import * as transcribers from '../lib/transcribers.js'
import {
  suffixMediaTypeMap as mediaTypes,
  guessMediaType,
}  from '../lib/mediatypes.js'
import { CONTEXT, GRAPH, ID } from '../lib/jsonld/keywords.js'
import {visualize} from './visualizer.js'
import {renderArrows} from './arrows.js'
import {toggleTheme} from './theme.js'

const mediaTypeNames = {}
for (const name in mediaTypes) {
  const mediaType = mediaTypes[name]
  if (mediaTypeNames[mediaType]) continue
  mediaTypeNames[mediaTypes[name]] = name
}

export const ldtrEditor = {

  async init (window) {
    this.params = parseParams(window.location.search.substring(1))
    this.window = window

    window.addEventListener('load', () => {
      this.setupWidgetsAndHandlers()
      if (this.params.url) {
        this.loadData(decodeURIComponent(this.params.url))
      } else {
        this.params.edit = true
        this.updateView()
      }
    })
  },

  setupWidgetsAndHandlers () {
    let document = this.window.document
    this.body = document.body

    this.setupView()
    this.setupModeControls()
    this.setupEditAreaControls()

    this.window.addEventListener('popstate', evt => {
      this.currentData = evt.state
      this.params = parseParams(window.location.search.substring(1))
      this.previousDataUrl = this.params.url
      this.setEditorData(toJson(this.currentData))
      this.process(this.currentData)
    })
  },

  setupView() {
    this.viewDiv = document.querySelector('#view')

    document.addEventListener('dblclick', async evt => {
      let link = evt.target.closest('a:link')
      if (link) {
        evt.stopPropagation()
        evt.preventDefault()

        let href = link.attributes.href.value
        href = this.expandCurie(href)

        await this.loadData(href)

        this.viewDiv.scrollTo({
          left: this.body.offsetLeft,
          top: this.body.offsetTop,
          behavior: 'smooth'
        })
      }
    })
  },

  setupModeControls() {
    this.toggles = []

    const toggleEdit = () => {
      this.params.edit = !this.params.edit
      if (!this.params.edit && this.params.syntax) {
        toggleSyntax()
      } else {
        this.updateView()
      }
    }
    let toggleedit = document.querySelector('#toggleedit')
    toggleedit.addEventListener('click', toggleEdit)
    this.toggles.push(() => {
      toggleedit.textContent = this.params.edit ? '»' : '«'
    })

    const toggleSyntax = () => {
      if (this.params.syntax) {
         this.hadSyntax = this.params.syntax
        delete this.params.syntax
      } else {
        this.params.syntax = this.hadSyntax || 'jsonld'
        this.params.edit = true
      }
      this.updateView()
    }
    let togglesyntax = document.querySelector('#togglesyntax')
    togglesyntax.addEventListener('click', toggleSyntax)

    this.syntaxArea = document.querySelector('#syntax > textarea')

    this.syntaxTypeSelect = document.querySelector('select#syntaxtypesel')
    setupTypeSelect(this.syntaxTypeSelect, async type => {
      this.params.syntax = mediaTypeNames[type]
      let text = await serializeData(this.currentData, type)
      setDataText(text, type, this.syntaxArea, this.syntaxTypeSelect)
    })

    let togglearrows = document.querySelector('#togglearrows')
    const toggleArrows = () => {
      if (this.params.arrows === 'off') {
        delete this.params.arrows
      } else {
        this.params.arrows = 'off'
      }
      this.updateView()
    }
    togglearrows.addEventListener('click', toggleArrows)
    this.toggles.push(() => {
      togglearrows.textContent = this.params.arrows === 'off' ? '⤯' : '⤤'
    })

    let darktoggle = document.querySelector('#darktoggle')
    darktoggle.addEventListener('click', toggleTheme)
    toggleTheme()

    document.addEventListener('keydown', evt => {
      if (evt.target.closest('input, textarea, select')) {
        return
      }
      if (!evt.shiftKey) {
        return
      }
      switch (evt.key) {
        case 'E':
          toggleEdit()
          break
        case 'D':
          toggleTheme()
          break
        case 'S':
          toggleSyntax()
          break
        case 'A':
          toggleArrows()
          break
      }
    })
  },

  setupEditAreaControls() {
    this.editorArea = document.querySelector('#editor')

    this.editorArea.onkeyup = function () {
      this.onEdit()
    }.bind(this)

    this.statusDiv = document.querySelector('#status')
    this.urlInput = document.querySelector('#url')

    let reload = document.querySelector('#reload')
    reload.addEventListener('click', async evt => {
      this.loadData(this.urlInput.value)
    })

    this.typeSelect = document.querySelector('select#typesel')
    setupTypeSelect(this.typeSelect, async type => {
      let text = await serializeData(this.currentData, type)
      this.setEditorData(text, type)
    })
  },

  updateView () {
    if (this.params.edit) {
      this.body.classList.add('edit')
    } else {
      this.body.classList.remove('edit')
    }

    if (this.params.syntax) {
      this.body.classList.add('syntax')
      this.viewSyntax()
    } else {
      this.body.classList.remove('syntax')
      this.viewData()
    }

    for (let toggle of this.toggles) {
      toggle()
    }

    this.updateAppUrl()
  },

  async viewSyntax () {
    let type = mediaTypes[this.params.syntax]
    let text = await serializeData(this.currentData, type)
    setDataText(text, type, this.syntaxArea, this.syntaxTypeSelect)
  },

  async viewData () {
    if (!this.currentData) {
      return
    }
    visualize(this.viewDiv, this.currentData, this.params)
    addViewControls(this.viewDiv)
    if (this.params.arrows !== 'off') {
      renderArrows(this.viewDiv)
    }
  },

  async loadData (url) {
    if (!url) return

    this.body.classList.add('loading')

    let headers = transcribers.requestHeaders()
    let result
    try {
      result = await readSource(url, headers)
    } catch (e) {
      this.body.classList.remove('loading')
      console.error(e)
      return
    }

    let { data, type } = result
    if (data.nodeType === 9) {
      data = data.documentElement.outerHTML
    }
    this.params.url = url
    this.urlInput.value = url
    if (!(type in transcribers.transcribers)) {
      type = guessMediaType(url)
    }

    this.setEditorData(data, type)

    this.statusDiv.innerText = ''
    await this.parseAndProcess()

    this.body.classList.remove('loading')

    // force browser to recognize dynamically generated :target
    if (this.window.location.hash) {
      this.window.location = this.window.location.hash
    }
  },

  updateAppUrl () {
    let appUrl = this.buildAppUrl()

    let title = this.window.document.title

    let changedDataUrl = this.params.url != null && this.previousDataUrl != this.params.url
    if (this.params.url) {
      this.previousDataUrl = this.params.url
    }

    if (changedDataUrl) {
      this.window.history.pushState(this.currentData, title, appUrl)
    } else {
      this.window.history.replaceState(this.currentData, title, appUrl)
    }
  },

  buildAppUrl () {
    let params = []
    if (this.params.url) params.push(`url=${escape(this.params.url)}`)
    if (this.params.edit) params.push('edit=true')
    if (this.params.syntax) params.push(`syntax=${this.params.syntax}`)
    if (this.params.arrows) params.push(`arrows=${this.params.arrows}`)
    let loc = this.window.location.toString()

    let query = '?' + params.join('&')
    let appUrl = loc.replace(/(\?.*)?$/, query)

    return appUrl
  },

  setEditorData (data, type) {
    setDataText(data, type, this.editorArea, this.typeSelect)
  },

  async onEdit () {
    let data = this.editorArea.value
    var pos = this.editorArea.selectionStart
    var row = 1
    var col = 1
    for (var i=0; i < pos; i++) {
      if (data[i] === '\n') {
        row += 1
        col = 1
      } else {
        col++
      }
    }
    this.statusDiv.innerText = 'Line: '+ row +' Col: '+ col +' \n'

    // TODO: only if this.editorArea was modified...
    this.parseAndProcess()
  },

  async parseAndProcess () {
    let result
    try {
      result = await this.parseData()
    } catch (e) {
      if (!e.location)
        throw e
      this.statusDiv.classList.add('error')
      this.statusDiv.innerText += e.name +' at Line: '+ e.location.start.line
        +' Col: '+ e.location.start.column +'\n'+ e.message
      return
    }
    this.process(result)
  },

  async process (result) {
    this.currentData = result

    this.statusDiv.classList.remove('error')
    if (!this.statusDiv.innerText.endsWith('OK')) {
      this.statusDiv.innerText += "OK"
    }

    if (this.params.indexed) {
      const indexer = await import('../lib/util/indexer.js')
      this.currentData = indexer.index(result)
    }

    this.updateView()
  },

  async parseData () {
    let data = this.editorArea.value
    let index = this.typeSelect.selectedIndex
    let type = this.typeSelect.options[index > -1 ? index : 0].value
    let url = this.urlInput.value
    let transcribe = transcribers.transcribers[type]

    return await transcribe({data, type, base: url})
  },

  expandCurie (href) {
    let ctx = this.currentData[CONTEXT]
    let pfx = href.split(':', 1)
    if (ctx && pfx in ctx) {
      href = `${ctx[pfx]}${href.substring(pfx.length + 2)}`
    }
    return href
  }

}

function parseParams (query) {
  return query.split(/\&/).reduce(function (map, pair) {
    let [key, value] = pair.split(/=/)
    if (key === 'url') {
      value = unescape(value)
    }
    map[key] = value || true
    return map
  }, {})
}

function toJson (data) {
  return JSON.stringify(data, null, 2)
}

async function serializeData(data, type) {
  if (type === mediaTypes.jsonld) {
    return toJson(data)
  } else {
    let modulepromise
    switch (type) {
      case mediaTypes.ttl:
      case mediaTypes.trig:
      modulepromise = await import('../lib/trig/serializer.js')
      break
      case mediaTypes.rdf:
      modulepromise = await import('../lib/rdfxml/serializer.js')
      break
    }
    if (modulepromise) {
      const {serialize} = await modulepromise
      let chunks = []
      serialize(data, {write (chunk) {chunks.push(chunk)}})
      return chunks.join('')
    }
  }
}

function addViewControls(container) {
  const document = container.ownerDocument

  document.querySelectorAll('[id].card').forEach(target => {
    target.addEventListener('click', evt => {
      if (evt.ctrlKey || evt.metaKey) return

      target.classList.toggle('selected')
      evt.preventDefault()
    })
  })

  document.querySelectorAll('.card a.ref').forEach(link => {
    let targetId = link.attributes.href.value
    let target = document.getElementById(targetId)
    if (!target) return

    let card = link.closest('[id].card')

    link.addEventListener('click', evt => {
      if (evt.ctrlKey || evt.metaKey) return

      card.classList.remove('selected')
      link.classList.toggle('selected')
      evt.stopPropagation()
      evt.preventDefault()
      container.scrollTo({
        left: target.offsetLeft,
        top: target.offsetTop,
        behavior: 'smooth'
      })
      target.classList.add('selected')
    })

  })
}

const mediaTypeLabels = {
  ttl: 'Turtle',
  trig: 'TriG',
  jsonld: 'JSON-LD',
  xml: 'RDF/XML'
}

function setupTypeSelect(typeSelect, onTypeSelect) {
  for (const typename in mediaTypeLabels) {
    const label = mediaTypeLabels[typename]
    const type = mediaTypes[typename]
    if (type in transcribers.transcribers) {
      typeSelect.add(new Option(label, type))
      typeSelect.selectedOptions[0].value
    }
  }

  typeSelect.addEventListener('change', async evt => {
    // convertEditorData
    let type = typeSelect.options[typeSelect.selectedIndex].value
    onTypeSelect(type)
  })
}

function setDataText (data, type, formElement, typeSelect) {
  formElement.value = data
  typeSelect.selectedIndex = Array.prototype.findIndex.call(
      typeSelect.options, it => it.value === type)
}
