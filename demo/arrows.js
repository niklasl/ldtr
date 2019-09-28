let computePaths
let observer

export function renderArrows(container) {
  const SVGNS = 'http://www.w3.org/2000/svg'
  let svg = document.createElementNS(SVGNS, 'svg')
  svg.innerHTML = `
  <defs>
    <marker id="arrowhead" orient="auto" markerWidth="2" markerHeight="4"
            refX="0.1" refY="2">
      <path d="M0,0 V4 L2,2 Z" />
    </marker>
    <marker id="arrowhead-rel" orient="auto" markerWidth="4" markerHeight="8"
            refX="0.1" refY="4">
      <path d="M0,0 V8 L4,4 Z" />
    </marker>
    <marker id="arrowhead-rev" orient="auto" markerWidth="4" markerHeight="8"
            refX="0.1" refY="4">
      <path d="M0,0 V8 L4,4 Z" />
    </marker>
  </defs>
  `
  svg.style.height = 'auto'
  svg.style.height = `${container.scrollHeight}px`
  container.appendChild(svg)

  computePaths = []

  document.querySelectorAll('[id].card').forEach(target => {
    target.addEventListener('click', evt => {
      target.classList.toggle('selected')
      evt.preventDefault()
    })
  })

  document.querySelectorAll('a.ref').forEach(link => {
    let idx = link.href.indexOf('#')
    let targetId = link.href.substring(idx + 1)
    let target = document.getElementById(targetId)
    if (!target) return

    let arrow = document.createElementNS(SVGNS, 'path')
    arrow.classList.add('arrow')

    let arrowLabel = document.createElement('span')
    arrowLabel.classList.add('arrow')
    let label = link.closest('article > p, div > p, div').querySelector('b')
    if (label) {
      arrowLabel.textContent = label.textContent
      container.appendChild(arrowLabel)
    }

    let computePath = () => {
      let linkX = link.offsetLeft
      let linkY = link.offsetTop + (link.offsetHeight / 2)

      let tgtX = target.offsetLeft
      let tgtY = target.offsetTop

      let c1, c2

      linkX += link.offsetWidth

      let targetToLeft = linkX > (tgtX + target.offsetWidth)
      let targetToRight = linkX < tgtX
      let targetAbove = linkY > (tgtY + target.offsetHeight)
      let targetBelow = linkY < tgtY

      if (targetToRight) {
        c1 = linkX + ((tgtX-linkX) / 4)
        c2 = linkY + ((tgtY-linkY) / 4)
      } else {
        c1 = linkX + ((linkX-tgtX) / 4)
        c2 = linkY + ((tgtY-linkY) / 4)
      }

      if (targetToLeft) {
        tgtX += target.offsetWidth
      } else if (!targetToRight) {
        tgtX += target.offsetWidth / 2
      }
      if (targetAbove) {
        tgtY += target.offsetHeight
      } else if (!targetBelow) {
        tgtY += target.offsetHeight / 2
      }

      let c = `C${c1},${c2} ${c1},${c2}`

      let d = `M${linkX},${linkY} ${c} ${tgtX},${tgtY}`
      arrow.setAttribute('d', d)

      let labelX = tgtX - ((tgtX-linkX) * 0.1)
      let labelY = tgtY - ((tgtY-linkY) * 0.1)

      if (label) {
        arrowLabel.style.left = `${labelX}px`
        arrowLabel.style.top = `${labelY}px`
      }
    }
    computePath()
    computePaths.push(computePath)

    link.addEventListener('click', evt => {
      linkOwner.classList.remove('selected')
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
    let linkOwner = link.closest('[id].card')
    linkOwner.addEventListener('mouseover', evt => {
      arrow.classList.add('rel')
    })
    linkOwner.addEventListener('mouseout', evt => {
      if (linkOwner.classList.contains('selected')) return
      arrow.classList.remove('rel')
    })

    target.addEventListener('mouseover', evt => {
      arrow.classList.add('rev')
      if (label) arrowLabel.classList.add('rev')
    })
    target.addEventListener('mouseout', evt => {
      if (target.classList.contains('selected')) return
      arrow.classList.remove('rev')
      if (label) arrowLabel.classList.remove('rev')
    })

    if (label) {
      arrowLabel.addEventListener('mouseover', evt => {
        arrow.classList.add('rev')
        if (label) arrowLabel.classList.add('rev')
      })
      arrowLabel.addEventListener('mouseout', evt => {
        if (target.classList.contains('selected')) return
        arrow.classList.remove('rev')
        if (label) arrowLabel.classList.remove('rev')
      })
      arrowLabel.addEventListener('click', evt => {
        target.classList.remove('selected')
        linkOwner.classList.add('selected')
        container.scrollTo({
          left: linkOwner.offsetLeft,
          top: linkOwner.offsetTop,
          behavior: 'smooth'
        })
      })
    }

    svg.appendChild(arrow)
    svg.appendChild(document.createTextNode('\n   '))

  })

  function recomputePaths() {
    if (computePaths) computePaths.forEach(f => { f() })
    svg.style.height = 'auto'
    svg.style.height = `${container.scrollHeight}px`
  }

  if (observer) {
    observer.disconnect()
  }
  observer = new MutationObserver(recomputePaths)
  observer.observe(document.body, {attributes: true})

  window.removeEventListener('resize', recomputePaths)
  window.addEventListener('resize', recomputePaths)
}
