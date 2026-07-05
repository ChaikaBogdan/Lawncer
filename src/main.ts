import './style.css'
import { createDemoScenario } from './scenarios/demo.ts'
import { mountGame } from './ui/game.ts'

const app = document.querySelector<HTMLDivElement>('#app')!
mountGame(app, createDemoScenario())
