import type { Casemapping } from './isupport'

export const ASCII_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const ASCII_LOWER = 'abcdefghijklmnopqrstuvwxyz'
export const RFC1459_UPPER = ASCII_UPPER + '[]^\\'
export const RFC1459_LOWER = ASCII_LOWER + '{}~|'

function replace (val: string, upper: string, lower: string) {
  let out = ''
  for (const char of val) {
    if (upper.includes(char)) out += lower[upper.indexOf(char)]
    else out += char
  }
  return out
}

export function casefold (mapping: Casemapping, val: string) {
  switch (mapping) {
    case 'rfc1459':
      return replace(val, RFC1459_UPPER, RFC1459_LOWER)
    case 'ascii':
      return replace(val, ASCII_UPPER, ASCII_LOWER)
    default:
      throw new TypeError('Invalid mapping provided')
  }
}
