let lightstyle = null
let darkstyle = null
let currentstyle = null

export function toggleTheme () {
  lightstyle = document.querySelector('link[rel~=stylesheet].light')
  darkstyle = document.querySelector('link[rel~=stylesheet].dark')

  if (currentstyle == null) {
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches
    currentstyle = prefersDarkScheme ? darkstyle : lightstyle
  }

  let activestyle = darkstyle
  let altstyle = lightstyle
  if (currentstyle !== darkstyle) {
    activestyle = lightstyle
    altstyle = darkstyle
  }

  activestyle.setAttribute('rel', 'stylesheet')
  altstyle.setAttribute('rel', 'stylesheet alternate')
  currentstyle = altstyle
}
