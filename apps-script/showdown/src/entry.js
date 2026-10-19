// Pokémon Showdown's battle simulator and the pieces to follow a battle in
// a browser, bundled for DEBROD's arcade as the global PkmnShowdown.
import { BattleStreams, Teams, Dex, toID } from '@pkmn/sim'
import { TeamGenerators } from '@pkmn/randoms'
import { Battle } from '@pkmn/client'
import { Generations } from '@pkmn/data'
import { Protocol } from '@pkmn/protocol'
import { LogFormatter } from '@pkmn/view'

Teams.setGeneratorFactory(TeamGenerators)

export { BattleStreams, Teams, Dex, toID, Battle, Generations, Protocol, LogFormatter }
