import { Socket } from 'net'
import { Server } from '../src'
import { Line, StatefulEncoder } from 'irctokens'
import { Numeric } from '../src/numerics'

const NICK = 'TestNick123412'
const CHAN = '##sometestchannel'
const HOST = 'irc.libera.chat'
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

server.on('PING', line => send(new Line({ command: 'PING', params: [line.params[0]] })))
server.on(Numeric.RPL_WELCOME, line => send(new Line({ command: 'JOIN', params: [CHAN] })))
