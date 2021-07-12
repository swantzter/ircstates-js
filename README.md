# ircstates

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![QA](https://github.com/swantzter/ircstates-js/actions/workflows/qa.yml/badge.svg)](https://github.com/swantzter/ircstates-js/actions/workflows/qa.yml)
[![Publish to NPM and GCR](https://github.com/swantzter/ircstates-js/actions/workflows/publish.yml/badge.svg)](https://github.com/swantzter/ircstates-js/actions/workflows/publish.yml)
[![codecov](https://codecov.io/gh/swantzter/ircstates-js/branch/main/graph/badge.svg)](https://codecov.io/gh/swantzter/ircstates-js)

TypeScript port of the python library [ircstates](https://github.com/jesopo/ircstates).
The major and minor version of this library will aim to follow upstream, patch
will be increased independently.

## rationale

I wanted a bare-bones reference implementation of taking byte input, parsing it
into tokens and then managing an IRC client session state from it.

with this library, you can have client session state managed for you and put
additional arbitrary functionality on top of it.

## usage

### installation

`$ npm install ircstates`

### simple

```typescript
import { Server } from 'ircstates'

const server = new Server("liberachat")
const lines = []
const e = new TextEncoder()

lines.push(server.recv(e.encode(':server 001 nick :hello world!\r\n')))
lines.push(server.recv(e.encode(':nick JOIN #chan\r\n')))

for (const line of lines) {
    server.parseTokens(line)
}

const chan = server.channels.get('#chan')
```

### socket to state

```typescript
iimport { Socket } from 'net'
import { Server } from '../src'
import { Line, StatefulEncoder } from 'irctokens'

const NICK = 'nickname'
const CHAN = '#chan'
const HOST = '127.0.0.1'
const PORT = 6667

const server = new Server('liberachat')
const e = new StatefulEncoder()
const s = new Socket()
s.connect(PORT, HOST)

function send (line: Line) {
  console.log(`> ${line.format()}`)
  e.push(line)
  const pending = e.pending()
  s.write(pending)
  e.pop(pending.length)
}

s.once('connect', () => {
  send(new Line({ command: 'USER', params: ['username', '0', '*', 'real name'] }))
  send(new Line({ command: 'NICK', params: [NICK] }))
})

s.on('data', data => {
  const recvLines = server.recv(Uint8Array.from(data))

  for (const line of recvLines) {
    server.parseTokens(line)
    console.log(`< ${line.format()}`)
  }
})

server.on('PING', (line: Line) => send(new Line({ command: 'PONG', params: [line.params[0]] })))
```

### get a user's channels
```typescript
console.log(server.users)
// Map(1) { 'nickname' => User }
const user = server.getUser(NICK) as User
console.log(user)
// User { channels: Set(1) { '#chan' }, username: '~username', hostname: '127.0.0.1' }
console.log(user.channels)
// Set(1) { '#chan' }
```

### get a channel's users
```typescript
console.log(server.channels)
// Map(1) { '#chan' => Channel }
const channel = server.getChannel('#chan')
console.log(channel)
// Channel { ... }
console.log(channel?.users)
// Map(1) { 'nickname' => ChannelUser { modes: Set(0) {} } }
```

### get a user's modes in channel
```typescript
const channel = server.getChannel(CHAN)
const channelUser = channel.users.get(NICK)
console.log(channelUser)
// ChannelUser { modes: Set(0) { 'o', 'v' } }
```

## contact

Come say hi at `#irctokens` on irc.libera.chat
