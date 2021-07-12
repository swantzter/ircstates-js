import { Name } from './name'

export class User {
  #nickname: Name

  username?: string
  hostname?: string
  realname?: string
  account?: string
  server?: string
  away?: string
  ip?: string
  channels: Set<string> = new Set()

  constructor (nickname: Name) {
    this.#nickname = nickname
  }

  getName () {
    return this.#nickname
  }

  get nickname () {
    return this.#nickname.normal
  }

  get nicknameLower () {
    return this.#nickname.folded
  }

  changeNickname (normal: string, folded: string) {
    this.#nickname.normal = normal
    this.#nickname.folded = folded
  }

  hostmask () {
    let hostmask: string = this.nickname
    if (this.username) hostmask += `!${this.username}`
    if (this.hostname) hostmask += `@${this.hostname}`
    return hostmask
  }

  userhost () {
    if (this.username && this.hostname) return `${this.username}@${this.hostname}`
    return undefined
  }
}
