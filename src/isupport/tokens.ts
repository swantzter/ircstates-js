export class ChanModes {
  constructor (
    public aModes: string[],
    public bModes: string[],
    public cModes: string[],
    public dModes: string[]
  ) {}
}

export class Prefix {
  constructor (
    public modes: string[],
    public prefixes: string[]
  ) {}

  fromMode (mode: string) {
    if (this.modes.includes(mode)) return this.prefixes[this.modes.indexOf(mode)]
  }

  fromPrefix (prefix: string) {
    if (this.prefixes.includes(prefix)) return this.modes[this.prefixes.indexOf(prefix)]
  }
}
