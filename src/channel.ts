import { ChannelUser } from './channel_user'
import { Name } from './name'

export class Channel {
  #name: Name

  users: Map<string, ChannelUser> = new Map()

  topic?: string
  topicSetter?: string
  topicTime?: Date

  created?: Date

  listModes: Map<string, Set<string>> = new Map()
  _listModesTemp: Map<string, Set<string>> = new Map()
  modes: Map<string, string | undefined> = new Map()

  constructor (name: Name) {
    this.#name = name
  }

  getName () {
    return this.#name
  }

  get name () {
    return this.#name.normal
  }

  get nameLower () {
    return this.#name.folded
  }

  changeName (normal: string, folded: string) {
    this.#name.normal = normal
    this.#name.folded = folded
  }

  addMode (char: string, listMode: boolean, param?: string) {
    if (listMode) {
      if (param) {
        const listModes = this.listModes.get(char) ?? new Set()
        if (!listModes.has(param)) listModes.add(param)
        this.listModes.set(char, listModes)
      }
    } else {
      this.modes.set(char, param)
    }
  }

  removeMode (char: string, param?: string) {
    if (this.listModes.has(char) && param) {
      const listModes = this.listModes.get(char)
      listModes?.delete(param)
      if (listModes) this.listModes.set(char, listModes)
    } else if (this.modes.has(char)) {
      this.modes.delete(char)
    }
  }
}
