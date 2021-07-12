import { ChanModes, Prefix } from './tokens'

export const CASEMAPPINGS = ['rfc1459', 'ascii'] as const
export type Casemapping = typeof CASEMAPPINGS[number]

function parseEscapes (str: string) {
  let out = ''
  for (let idx = 0; idx < str.length;) {
    if (str[idx] === '\\') {
      if (str[idx + 1] === 'x' && str.substring(idx + 2).length >= 2) {
        out += String.fromCharCode(parseInt(str.substring(idx + 2, idx + 4), 16))
        idx += 4
      } else {
        out += str[idx + 1]
        idx += 2
      }
    } else {
      out += str[idx]
      idx++
    }
  }
  return out
}

export class ISupport {
  raw: Record<string, string | undefined> = {}

  network?: string
  chanmodes = new ChanModes(['b'], ['k'], ['l'], ['i', 'm', 'n', 'p', 's', 't'])
  prefix = new Prefix(['o', 'v'], ['@', '+'])

  modes = 3 // -1 if "no limit"
  casemapping: Casemapping = 'rfc1459'
  chantypes = ['#']
  statusmsg: string[] = []

  callerid?: string
  excepts?: string
  invex?: string

  monitor?: number // -1 if "no limit"
  watch?: number // -1 if "no limit"
  whox = false
  nicklen = 9 // from RFC1459

  fromTokens (tokens: string[]) {
    for (const token of tokens) {
      let key: string
      let value: string | undefined
      ; [key, value] = token.split(/=(.*)/)
      value = value ? parseEscapes(value) : undefined
      this.raw[key] = value

      switch (key) {
        case 'NETWORK':
          this.network = value
          break

        case 'CHANMODES': {
          const [a, b, c, d] = (value as string).split(',').map(l => l.split(''))
          this.chanmodes = new ChanModes(a, b, c, d)
          break
        }

        case 'PREFIX': {
          const [modes, prefixes] = (value as string).substring(1).split(')').map(l => l.split(''))
          this.prefix = new Prefix(modes, prefixes)
          break
        }

        case 'STATUSMSG':
          this.statusmsg = value?.split('') ?? []
          break

        case 'MODES':
          this.modes = value ? parseInt(value, 10) : -1
          break
        case 'MONITOR':
          this.monitor = value ? parseInt(value, 10) : -1
          break
        case 'WATCH':
          this.watch = value ? parseInt(value, 10) : -1
          break

        case 'CASEMAPPING':
          if (CASEMAPPINGS.includes(value as Casemapping)) this.casemapping = value as Casemapping
          break

        case 'CHANTYPES':
          this.chantypes = (value as string).split('')
          break

        case 'CALLERID':
          this.callerid = value ?? 'g'
          break
        case 'EXCEPTS':
          this.excepts = value ?? 'e'
          break
        case 'INVEX':
          this.invex = value ?? 'I'
          break

        case 'WHOX':
          this.whox = true
          break

        case 'NICKLEN':
          this.nicklen = parseInt(value as string, 10)
      }
    }
  }
}
