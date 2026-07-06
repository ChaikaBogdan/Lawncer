import { RIFLE, SHOTGUN, SWORD } from '../engine/combat/weapons.ts'
import type { GameState, Position, TeamId, UnitState, Weapon } from '../engine/state/types.ts'

function mech(id: string, team: TeamId, name: string, pos: Position, weapon: Weapon): UnitState {
  return {
    id,
    team,
    name,
    pos,
    moveSpeed: 3,
    hasActivated: false,
    quickActionsUsed: 0,
    hp: 4,
    maxHp: 4,
    structure: 3,
    maxStructure: 3,
    heat: 0,
    heatCap: 4,
    stress: 3,
    maxStress: 3,
    weapon,
    evasion: 8,
    statuses: [],
    overwatch: false,
    brace: false,
    overchargeCount: 0,
    weaponDisabled: false,
  }
}

export function createDemoScenario(): GameState {
  return {
    round: 1,
    activeTeam: 'player',
    firstTeamThisRound: 'player',
    rngSeed: 'lawncer-demo-2',
    rngCalls: 0,
    map: {
      width: 8,
      height: 8,
      walls: [
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
        { x: 0, y: 5 },
        { x: 7, y: 2 },
        { x: 6, y: 6 },
        { x: 1, y: 1 },
      ],
      cover: [
        { x: 2, y: 4 },
        { x: 5, y: 3 },
      ],
    },
    units: [
      mech('player-1', 'player', 'Everest', { x: 1, y: 6 }, RIFLE),
      mech('player-2', 'player', 'Barbarossa', { x: 3, y: 6 }, SHOTGUN),
      mech('enemy-1', 'enemy', 'Sentinel', { x: 4, y: 1 }, RIFLE),
      mech('enemy-2', 'enemy', 'Wraith', { x: 6, y: 1 }, SWORD),
    ],
  }
}
