import {
  BRAWLER_FRAME,
  MIDLINE_FRAME,
  SNIPER_FRAME,
  SWORDSMAN_FRAME,
} from '../engine/state/frames.ts'
import type { Frame } from '../engine/state/frames.ts'
import type { GameState, Position, TeamId, UnitState } from '../engine/state/types.ts'

function mech(id: string, team: TeamId, name: string, pos: Position, frame: Frame): UnitState {
  return {
    id,
    team,
    name,
    pos,
    moveSpeed: frame.moveSpeed,
    hasActivated: false,
    quickActionsUsed: 0,
    hasMoved: false,
    hp: frame.maxHp,
    maxHp: frame.maxHp,
    structure: frame.maxStructure,
    maxStructure: frame.maxStructure,
    heat: 0,
    heatCap: frame.heatCap,
    stress: frame.maxStress,
    maxStress: frame.maxStress,
    weapon: frame.weapon,
    evasion: frame.evasion,
    armor: frame.armor,
    aiBehavior: frame.aiBehavior,
    systemReactionStatus: frame.systemReactionStatus,
    statuses: [],
    overwatch: false,
    brace: false,
    systemReactionArmed: false,
    systemReactionUses: 0,
    overchargeCount: 0,
    hasOvercharged: false,
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
      width: 12,
      height: 12,
      walls: [
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
        { x: 0, y: 5 },
        { x: 7, y: 2 },
        { x: 6, y: 6 },
        { x: 1, y: 1 },
        { x: 10, y: 3 },
        { x: 9, y: 9 },
      ],
      cover: [
        { x: 2, y: 4 },
        { x: 5, y: 3 },
        { x: 9, y: 5 },
      ],
    },
    units: [
      mech('player-1', 'player', 'Everest', { x: 1, y: 6 }, MIDLINE_FRAME),
      mech('player-2', 'player', 'Barbarossa', { x: 3, y: 6 }, BRAWLER_FRAME),
      mech('enemy-1', 'enemy', 'Sentinel', { x: 4, y: 1 }, SNIPER_FRAME),
      mech('enemy-2', 'enemy', 'Wraith', { x: 6, y: 1 }, SWORDSMAN_FRAME),
    ],
  }
}
