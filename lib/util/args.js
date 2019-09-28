export function option () {
  let parser = {
    spec: {args: []},

    flag (long, short, opts = {}) {
      opts.value = false
      return this.option(long, short, opts)
    },

    option (long, short, opts = {}) {
      if (typeof short === 'object') {
        opts = short
        short = null
      }
      let {help, symbol, value = null} = opts
      long = long.replace(/^--/, '')
      if (short) short = short.replace(/^-/, '')
      this.spec[long] = {short, value, help, symbol}
      return parser
    },

    parse (args) {
      let opts = {args: []}
      let alias = {}

      for (let key in this.spec) {
        let opt = this.spec[key]
        if (opt.value !== void 0) opts[key] = opt.value
        if (opt.short) alias[opt.short] = key
      }

      let j = -1
      for (let i = 0; i < args.length; i++) {
        if (i === j) continue
        let arg = args[i]
        if (arg[0] === '-') {
          let key, rest
          if (arg[1] === '-') {
            key = arg.substring(2)
          } else {
            key = alias[arg.substring(1, 2)]
            rest = arg.substring(2)
          }
          if (typeof opts[key] === 'boolean') {
            opts[key] = true
            if (rest) {
              for (let c of rest) {
                let key = alias[c]
                if (key && typeof opts[key] === 'boolean') {
                  opts[key] = true
                }
              }
            }
          } else if (opts[key] === null) {
            opts[key] = rest || args[(j = i + 1)]
          }
        } else {
          opts.args.push(arg)
        }
      }

      return opts
    },

    logOptions () {
      for (let key in this.spec) {
        if (key === 'args') continue

        let {short, value, help, symbol} = this.spec[key]

        if (symbol) value = symbol
        else if (value === false) value = ''
        else if (value == null) value = key.toUpperCase()

        short = short ? `-${short}, ` : '    '
        let keyValue = value ? `${key} ${value}` : key

        let msg = `  ${short}--${keyValue}`
        let sep = '                                '
        if (msg.length >= sep.length) {
          msg = msg.substring(0, msg.length - ((msg.length - sep.length) + 4))
          msg += '...'
        }
        if (help) {
          sep = sep.substring(msg.length)
          msg += `${sep}${help}`
        }

        console.log(msg)
      }
    }

  }

  parser.option.apply(parser, arguments)
  return parser
}
