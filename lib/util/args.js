export function option () {
  let spec = {args: []}
  let parser = {
    option (long, short, defaultValue) {
      long = long.replace(/^--/, '')
      short = short.replace(/^-/, '')
      spec[long] = {short, defaultValue}
      return parser
    },

    parse (args) {
      let opts = {args: []}
      let alias = {}

      for (let key in spec) {
        let opt = spec[key]
        if (opt.defaultValue !== void 0) opts[key] = opt.defaultValue
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
    }
  }

  parser.option.apply(parser, arguments)
  return parser
}
