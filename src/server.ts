import { User } from './user'
import { Channel } from './channel'
import { hostmask, Hostmask, Line, StatefulDecoder } from 'irctokens'
import { casefold } from './casemap'
import { ISupport } from './isupport'
import { Name } from './name'
import { ChannelUser } from './channel_user'
import { EventEmitter } from 'events'
import { Numeric } from './numerics'

export type CommandHandler = (line: Line) => void

export class ServerException extends Error {}
export class ServerDisconnectedException extends Error {}

const WHO_TYPE = '735'

export class Server extends EventEmitter {
  constructor (public name: string) {
    super()
    // TODO: attach all these in a better way, decorators?
    this.on(Numeric.RPL_WELCOME, this.handleWelcome)
    this.on(Numeric.RPL_ISUPPORT, this.handleISupport)
    this.on(Numeric.RPL_MOTDSTART, this.handleMotdStart)
    this.on(Numeric.RPL_MOTD, this.handleMotd)
    this.on('NICK', this.handleNick)
    this.on('JOIN', this.handleJoin)
    this.on('PART', this.handlePart)
    this.on('KICK', this.handleKick)
    this.on('QUIT', this.handleQuit)
    this.on('ERROR', this.handleError)
    this.on(Numeric.RPL_NAMREPLY, this.handleNames)
    this.on(Numeric.RPL_CREATIONTIME, this.handleCreationTime)
    this.on('TOPIC', this.handleTopic)
    this.on(Numeric.RPL_TOPIC, this.handleTopicNum)
    this.on(Numeric.RPL_TOPICWHOTIME, this.handleTopicTime)
    this.on('MODE', this.handleMode)
    this.on(Numeric.RPL_CHANNELMODEIS, this.handleChannelModeIs)
    this.on(Numeric.RPL_UMODEIS, this.handleUModeIs)
    this.on(Numeric.RPL_BANLIST, this.handleBanlist)
    this.on(Numeric.RPL_ENDOFBANLIST, this.handleBanlistEnd)
    this.on(Numeric.RPL_QUIETLIST, this.handleQuietlist)
    this.on(Numeric.RPL_ENDOFQUIETLIST, this.handleQuietlistEnd)
    this.on('PRIVMSG', this.handleMessage)
    this.on('NOTICE', this.handleMessage)
    this.on('TAGMSG', this.handleMessage)
    this.on(Numeric.RPL_VISIBLEHOST, this.handleVisiblehost)
    this.on(Numeric.RPL_WHOREPLY, this.handleWho)
    this.on(Numeric.RPL_WHOISUSER, this.handleWhoisUser)
    this.on('CHGHOST', this.handleChghost)
    this.on('SETNAME', this.handleSetname)
    this.on('RENAME', this.handleRename)
    this.on(Numeric.RPL_AWAY, this.handleAwayNum)
    this.on('AWAY', this.handleAway)
    this.on('ACCOUNT', this.handleAccount)
    this.on('CAP', this.handleCap)
    this.on(Numeric.RPL_LOGGEDIN, this.handleLoggedin)
    this.on(Numeric.RPL_LOGGEDOUT, this.handleLoggedout)
  }

  nickname = ''
  nicknameLower = ''
  username?: string
  hostname?: string
  realname?: string
  account?: string
  server?: string
  away?: string
  ip?: string

  registered = false
  modes: Set<string> = new Set()
  motd: string[] = []

  #decoder = new StatefulDecoder()

  users: Map<string, User> = new Map()
  channels: Map<string, Channel> = new Map()

  isupport = new ISupport()

  hasCap = false
  #tempCaps: Map<string, string> = new Map()
  availableCaps: Map<string, string> = new Map()
  agreedCaps: Set<string> = new Set()

  recv (data: Uint8Array) {
    const lines = this.#decoder.push(data)
    if (!lines) throw new ServerDisconnectedException()
    return lines
  }

  parseTokens (line: Line): void {
    if (line.command) this.emit(line.command, line)
  }

  public casefold (s1: string) {
    return casefold(this.isupport.casemapping, s1)
  }

  casefoldEquals (s1: string, s2: string) {
    return this.casefold(s1) === this.casefold(s2)
  }

  isMe (nickname: string) {
    return this.casefold(nickname) === this.nicknameLower
  }

  hasUser (nickname: string) {
    return this.users.get(this.casefold(nickname))
  }

  getUser (nickname: string) {
    return this.users.get(this.casefold(nickname))
  }

  private addUser (nickname: string, nicknameLower: string) {
    const user = new User(new Name(nickname, nicknameLower))
    this.users.set(nicknameLower, user)
  }

  isChannel (target: string) {
    return this.isupport.chantypes.includes(target[0])
  }

  hasChannel (name: string) {
    return this.channels.has(this.casefold(name))
  }

  getChannel (name: string): Channel | undefined {
    return this.channels.get(this.casefold(name))
  }

  private userJoin (channel: Channel, user: User) {
    const channelUser = new ChannelUser(user.getName(), channel.getName())

    user.channels.add(this.casefold(channel.name))
    channel.users.set(user.nicknameLower, channelUser)
    return channelUser
  }

  prepareWhox (target: string) {
    return new Line({ command: 'WHO', params: [target, `n%afhinrstu,${WHO_TYPE}`] })
  }

  private thisHostmask (hostmask: Hostmask) {
    this.nickname = hostmask.nickname
    if (hostmask.username) this.username = hostmask.username
    if (hostmask.hostname) this.hostname = hostmask.hostname
  }

  // first message reliably sent to us after registration is complete
  private handleWelcome (line: Line) {
    this.nickname = line.params[0]
    this.nicknameLower = this.casefold(line.params[0])
    this.registered = true
  }

  // https://defs.ircdocs.horse/defs/isupport.html
  private handleISupport (line: Line) {
    const params = [...line.params]
    params.pop()
    params.shift()
    this.isupport.fromTokens(params)
  }

  // start of MOTD
  private handleMotdStart (line: Line) {
    this.motd = []
    this.handleMotd(line)
  }

  // line of MOTD
  private handleMotd (line: Line) {
    this.motd.push(line.params[1])
  }

  private handleNick (line: Line) {
    const newNickname = line.params[0]
    const newNicknameLower = this.casefold(newNickname)
    const nicknameLower = this.casefold(line.hostmask.nickname)
    const user = this.getUser(line.hostmask.nickname)

    if (user) {
      this.users.delete(nicknameLower)
      user.changeNickname(newNickname, newNicknameLower)
      this.users.set(newNicknameLower, user)

      for (const channelLower of user.channels) {
        const channel = this.channels.get(channelLower)
        if (!channel) continue
        const channelUser = channel.users.get(line.hostmask.nickname)
        if (!channelUser) continue
        channel.users.delete(nicknameLower)
        channel.users.set(user.nicknameLower, channelUser)
      }
    }

    if (this.isMe(line.hostmask.nickname)) {
      this.nickname = newNickname
      this.nicknameLower = newNicknameLower
    }
  }

  private handleJoin (line: Line) {
    const extended = line.params.length === 3

    const account = extended ? line.params[1].replace(/(^\*+|\*+$)/g, '') : undefined
    const realname = extended ? line.params[2] : undefined

    const channelLower = this.casefold(line.params[0])
    const nicknameLower = this.casefold(line.hostmask.nickname)

    if (this.isMe(nicknameLower)) {
      if (!this.channels.has(channelLower)) {
        const channel = new Channel(new Name(line.params[0], channelLower))
        // TODO: put this somewhere better
        for (const mode of this.isupport.chanmodes.aModes) {
          channel.listModes.set(mode, new Set())
        }
        this.channels.set(channelLower, channel)
      }

      this.thisHostmask(line.hostmask)
      if (extended) {
        this.account = account
        this.realname = realname
      }
    }

    const channel = this.channels.get(channelLower) as Channel
    if (channel) {
      if (!this.users.has(nicknameLower)) this.addUser(line.hostmask.nickname, nicknameLower)
      const user = this.users.get(nicknameLower) as User

      if (line.hostmask.username) user.username = line.hostmask.username
      if (line.hostmask.hostname) user.hostname = line.hostmask.hostname
      if (extended) {
        user.account = account
        user.realname = realname
      }

      this.userJoin(channel, user)
    }
  }

  private userPart (line: Line, nickname: string, channelName: string): User | undefined {
    const channelLower = this.casefold(channelName)

    let user: User | undefined
    const channel = this.channels.get(channelLower)
    if (channel) {
      const nicknameLower = this.casefold(nickname)

      user = this.getUser(nickname)
      if (user) {
        user.channels.delete(channel.nameLower)
        channel.users.delete(user.nicknameLower)
        if (!user.channels.size) this.users.delete(nicknameLower)
      }

      if (this.isMe(nickname)) {
        this.channels.delete(channelLower)

        for (const [key] of channel.users) {
          const ruser = this.users.get(key) as User
          ruser.channels.delete(channel.nameLower)
          if (!ruser.channels.size) this.users.delete(ruser.nicknameLower)
        }
      }
    }
    return user
  }

  private handlePart (line: Line) {
    this.userPart(line, line.hostmask.nickname, line.params[0])
  }

  private handleKick (line: Line) {
    this.userPart(line, line.params[1], line.params[0])
  }

  private selfQuit () {
    this.users.clear()
    this.channels.clear()
  }

  private handleQuit (line: Line) {
    const nicknameLower = this.casefold(line.hostmask.nickname)

    if (this.isMe(nicknameLower)) {
      this.selfQuit()
    } else {
      const user = this.users.get(nicknameLower)
      if (user) {
        this.users.delete(nicknameLower)
        for (const channelLower of user.channels) {
          const channel = this.channels.get(channelLower) as Channel
          channel.users.delete(user.nicknameLower)
        }
      }
    }
  }

  private handleError (line: Line) {
    this.selfQuit()
  }

  private handleNames (line: Line) {
    const channel = this.getChannel(line.params[2])
    if (channel) {
      const nicknames = line.params[3].split(' ').filter(n => !!n)

      for (const nickname of nicknames) {
        let modes = ''
        for (const char of nickname) {
          const mode = this.isupport.prefix.fromPrefix(char)
          if (mode) modes += mode
          else break
        }

        const hm = hostmask(nickname.substring(modes.length))
        const nicknameLower = this.casefold(nickname)
        if (!this.users.has(nicknameLower)) this.addUser(nickname, nicknameLower)
        const user = this.users.get(nicknameLower) as User
        const channelUser = this.userJoin(channel, user)

        if (hm.username) user.username = hm.username
        if (hm.hostname) user.hostname = hm.hostname

        if (this.isMe(nicknameLower)) this.thisHostmask(hm)

        for (const mode of modes) {
          if (!channelUser.modes.has(mode)) channelUser.modes.add(mode)
        }
      }
    }
  }

  private handleCreationTime (line: Line) {
    const channel = this.getChannel(line.params[1])
    if (channel) {
      channel.created = new Date(parseInt(line.params[2], 10) * 1000)
    }
  }

  private handleTopic (line: Line) {
    const channel = this.getChannel(line.params[0])
    if (channel) {
      channel.topic = line.params[1]
      channel.topicSetter = line.source
      channel.topicTime = new Date()
    }
  }

  // topic text, "TOPIC #channel" response (and on-join)
  private handleTopicNum (line: Line) {
    const channel = this.getChannel(line.params[1])
    if (channel) {
      channel.topic = line.params[2]
    }
  }

  // topic setby, "TOPIC #channel" response (and on-join)
  private handleTopicTime (line: Line) {
    const channel = this.getChannel(line.params[1])
    if (channel) {
      channel.topicSetter = line.params[2]
      channel.topicTime = new Date(parseInt(line.params[3], 10) * 1000)
    }
  }

  private channelModes (channel: Channel, modes: string[], params: string[]) {
    const tokens: Array<[string, string | undefined]> = []

    for (const mode of modes) {
      const add = mode[0] === '+'
      const char = mode[1]
      let arg: string | undefined

      if (this.isupport.prefix.modes.includes(char)) { // a user's status
        arg = params.shift() as string
        const user = this.getUser(arg)

        if (user) {
          const channelUser = channel.users.get(user.nicknameLower) as ChannelUser

          if (add) channelUser.modes.add(char)
          else channelUser.modes.delete(char)
        }
      } else {
        let hasArg = false
        let isList = false
        if (this.isupport.chanmodes.aModes.includes(char)) {
          hasArg = true
          isList = true
        } else if (add) {
          hasArg = this.isupport.chanmodes.bModes.includes(char) ||
            this.isupport.chanmodes.cModes.includes(char)
        } else { // remove
          hasArg = this.isupport.chanmodes.bModes.includes(char)
        }

        if (hasArg) {
          arg = params.shift()
        }

        if (add) channel.addMode(char, isList, arg)
        else channel.removeMode(char, arg)
      }

      tokens.push([mode, arg])
    }

    return tokens
  }

  private handleMode (line: Line) {
    const target = line.params[0]
    const modesStr = line.params[1]
    const params = line.params.slice(2)

    let modifier = '+'
    const modes: string[] = []

    for (const c of modesStr) {
      if (['+', '-'].includes(c)) modifier = c
      else modes.push(`${modifier}${c}`)
    }

    const targetLower = this.casefold(target)
    if (this.isMe(targetLower)) {
      for (const mode of modes) {
        const add = mode[0] === '+'
        const char = mode[1]
        if (add) this.modes.add(char)
        else this.modes.delete(char)
      }
    } else if (this.channels.has(targetLower)) {
      const channel = this.channels.get(targetLower) as Channel
      this.channelModes(channel, modes, params)
    }
  }

  // channel modes, "MODE #channel" response (sometimes on-join?)
  private handleChannelModeIs (line: Line) {
    const channel = this.getChannel(line.params[1])
    if (channel) {
      const modes = line.params[2].replace(/^\++/, '').split('').map(c => `+${c}`)
      const params = line.params.slice(3)
      this.channelModes(channel, modes, params)
    }
  }

  // our own user modes, "MODE nickname" response (sometimes on-connect?)
  private handleUModeIs (line: Line) {
    for (const c of line.params[2].replace(/^\++/, '')) {
      this.modes.add(c)
    }
  }

  private modeList (channelName: string, mode: string, mask: string) {
    const channel = this.getChannel(channelName)
    if (channel) {
      if (!channel._listModesTemp.has(mode)) channel._listModesTemp.set(mode, new Set())
      channel._listModesTemp.get(mode)?.add(mask)
    }
  }

  private modeListEnd (channelName: string, mode: string) {
    const channel = this.getChannel(channelName)
    if (channel) {
      const mlist = channel._listModesTemp.get(mode)
      channel._listModesTemp.delete(mode)
      if (mlist) {
        channel.listModes.set(mode, mlist)
      }
    }
  }

  private handleBanlist ({ params }: Line) {
    const channel = params[1]
    const mask = params[2]

    // if (params.length > 3) {
    //   // parse these out but we're not storing them yet
    //   const setBy = params[3]
    //   const setAt = new Date(parseInt(params[4], 10) * 1000)
    // }

    this.modeList(channel, 'b', mask)
  }

  private handleBanlistEnd ({ params }: Line) {
    const channel = params[1]
    this.modeListEnd(channel, 'b')
  }

  private handleQuietlist ({ params }: Line) {
    const channel = params[1]
    const mode = params[2]
    const mask = params[3]
    // const setBy = params[4]
    // const setAt = new Date(parseInt(params[5], 10) * 1000)

    this.modeList(channel, mode, mask)
  }

  private handleQuietlistEnd ({ params }: Line) {
    const channel = params[1]
    const mode = params[2]
    this.modeListEnd(channel, mode)
  }

  private handleMessage (line: Line) {
    if (!line.source) return undefined
    // const message = line.params[1]
    if (this.isMe(line.hostmask.nickname)) this.thisHostmask(line.hostmask)

    let user = this.getUser(line.hostmask.nickname)
    if (!user) user = new User(new Name(line.hostmask.nickname, this.casefold(line.hostmask.nickname)))

    if (line.hostmask.username) user.username = line.hostmask.username
    if (line.hostmask.hostname) user.hostname = line.hostmask.hostname

    let target = line.params[0]
    const statusmsg = []
    while (target) {
      if (this.isupport.statusmsg.includes(target[0])) {
        statusmsg.push(target[0])
        target = target.substring(1)
      } else {
        break
      }
    }
  }

  // our own hostname, sometimes username@hostname, when it changes
  private handleVisiblehost (line: Line) {
    const [uOrH, hostname] = line.params[1].split(/@(.*)/)
    if (hostname) {
      this.hostname = hostname
      this.username = uOrH
    } else {
      this.hostname = uOrH
    }
  }

  // WHO line, "WHO #channel|nickname" response
  private handleWho (line: Line) {
    const nickname = line.params[5]
    const username = line.params[2]
    const hostname = line.params[3]
    const status = line.params[6]
    const away = status.includes('G') ? '' : undefined
    const realname = line.params[7].split(/ (.*)/)[1]

    const server = line.params[4] === '*' ? undefined : line.params[4]

    if (this.isMe(nickname)) {
      this.username = username
      this.hostname = hostname
      this.realname = realname
      this.server = server
      this.away = away
    }

    const user = this.getUser(nickname)
    if (user) {
      user.username = username
      user.hostname = hostname
      user.realname = realname
      user.server = server
      user.away = away
    }
  }

  private handleWhox ({ params }: Line) {
    if (params[1] !== WHO_TYPE || params.length !== 10) return

    const nickname = params[6]
    const username = params[2]
    const hostname = params[4]
    const status = params[7]
    const away = status.includes('G') ? '' : undefined
    const realname = params[9]
    const account = params[8] === '0' ? '' : params[8]
    const server = params[5] === '*' ? undefined : params[5]

    let ip: string | undefined
    if (params[3] !== '255.255.255.255') {
      // TODO: handle IP
    }

    const user = this.getUser(nickname)
    if (user) {
      user.username = username
      user.hostname = hostname
      user.realname = realname
      user.account = account
      user.server = server
      user.away = away
      user.ip = ip
    }

    if (this.isMe(nickname)) {
      this.username = username
      this.hostname = hostname
      this.realname = realname
      this.account = account
      this.server = server
      this.away = away
      this.ip = ip
    }
  }

  // WHOIS "user" line, one of "WHOIS nickname" response lines
  private handleWhoisUser ({ params }: Line) {
    const nickname = params[1]
    const username = params[2]
    const hostname = params[3]
    const realname = params[5]

    const user = this.getUser(username)
    if (user) {
      user.username = username
      user.hostname = hostname
      user.realname = realname
    }

    if (this.isMe(nickname)) {
      this.username = username
      this.hostname = hostname
      this.realname = realname
    }
  }

  private handleChghost ({ params, hostmask }: Line) {
    const username = params[0]
    const hostname = params[1]

    const user = this.getUser(hostmask.nickname)
    if (user) {
      user.username = username
      user.hostname = hostname
    }

    if (this.isMe(hostmask.nickname)) {
      this.username = username
      this.hostname = hostname
    }
  }

  private handleSetname ({ params, hostmask }: Line) {
    const realname = params[0]

    const user = this.getUser(hostmask.nickname)
    if (user) user.realname = realname

    if (this.isMe(hostmask.nickname)) this.realname = realname
  }

  private handleRename ({ params }: Line) {
    const sourceFold = this.casefold(params[0])
    const rename = params[1]
    const renameFold = this.casefold(rename)

    const channel = this.getChannel(sourceFold)
    if (channel) {
      channel.changeName(rename, renameFold)
      for (const [nickname] of channel.users) {
        const user = this.getUser(nickname)
        if (!user) continue
        user.channels.delete(sourceFold)
        user.channels.add(sourceFold)
      }

      this.channels.delete(sourceFold)
      this.channels.set(renameFold, channel)
    }
  }

  private handleAwayNum ({ params }: Line) {
    const nickname = params[1]
    const reason = params[2]

    const user = this.getUser(nickname)
    if (user) user.away = reason
    if (this.isMe(nickname)) this.away = reason
  }

  private handleAway ({ params, hostmask }: Line) {
    const away = params[0]

    const user = this.getUser(hostmask.nickname)
    if (user) user.away = away
    if (this.isMe(hostmask.nickname)) this.away = away
  }

  private handleAccount ({ params, hostmask }: Line) {
    const account = params[0].replace(/(^\*+|\*+$)/g, '')

    const user = this.getUser(hostmask.nickname)
    if (user) user.account = account
    if (this.isMe(hostmask.nickname)) this.account = account
  }

  private handleCap ({ params }: Line) {
    this.hasCap = true
    const subcommand = params[1].toLocaleUpperCase()
    const multiline = params[2] === '*'
    const caps = params[2 + (multiline ? 1 : 0)]

    const tokens: Map<string, string> = new Map()
    const tokensStr: string[] = [] // TODO: used?

    for (const cap of caps.split(' ').filter(c => !!c)) {
      tokensStr.push(cap)
      const [key, val] = cap.split(/=(.*)/)
      tokens.set(key, val)
    }

    switch (subcommand) {
      case 'LS': {
        this.#tempCaps = new Map([...this.#tempCaps, ...tokens])
        if (!multiline) {
          this.availableCaps = new Map(this.#tempCaps)
          this.#tempCaps.clear()
        }
        break
      }
      case 'NEW':
        this.availableCaps = new Map([...this.availableCaps, ...tokens])
        break
      case 'DEL': {
        for (const [key] of tokens) {
          this.availableCaps.delete(key)
          this.agreedCaps.delete(key)
        }
        break
      }
      case 'ACK': {
        for (let [key] of tokens) {
          if (key.startsWith('-')) {
            key = key.substring(1)
            this.agreedCaps.delete(key)
          } else if (this.availableCaps.has(key)) {
            this.agreedCaps.add(key)
          }
        }
      }
    }
  }

  private handleLoggedin ({ params }: Line) {
    const hm = hostmask(params[1])
    const account = params[2]

    this.account = account
    this.thisHostmask(hm)
  }

  private handleLoggedout ({ params }: Line) {
    const hm = hostmask(params[1])

    this.account = undefined
    this.thisHostmask(hm)
  }
}
