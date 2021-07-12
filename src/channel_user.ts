import { Name } from './name'

export class ChannelUser {
  #nickname: Name
  #channelName: Name

  modes: Set<string> = new Set()

  constructor (nickname: Name, channelName: Name) {
    this.#nickname = nickname
    this.#channelName = channelName
  }

  get nickname () {
    return this.#nickname.normal
  }

  get nicknameLower () {
    return this.#nickname.folded
  }

  get channel () {
    return this.#channelName.normal
  }
}
