import { useEffect, useRef, useState } from 'react'
import { DIFFICULTIES, type DifficultyId } from './ai/difficulty.ts'
import { MODE_MOVES, MOVE_EMOJI, MOVE_HAND, MOVE_LABEL, type Mode } from './game/moves.ts'
import { judge, matchWinner } from './game/rules.ts'
import { COUNTDOWN, useGame } from './game/useGame.ts'
import { AICard } from './ui/AICard.tsx'
import { BrainPanel } from './ui/BrainPanel.tsx'
import { CameraView } from './ui/CameraView.tsx'
import { Confetti } from './ui/Confetti.tsx'
import { Countdown } from './ui/Countdown.tsx'
import { FairnessProof } from './ui/FairnessProof.tsx'
import { MatchReport } from './ui/MatchReport.tsx'
import { RoundResult } from './ui/RoundResult.tsx'
import { Scoreboard } from './ui/Scoreboard.tsx'
import { DifficultyPicker } from './ui/DifficultyPicker.tsx'
import { isMuted, playSound, setMuted } from './ui/sounds.ts'
import { TrainerPanel, type ModelSource } from './ui/TrainerPanel.tsx'
import { loadSavedModel, loadShippedModel, saveModel, type GestureModel } from './vision/gestureModel.ts'
import { useHandTracking } from './vision/useHandTracking.ts'

type View = 'play' | 'train'

const RECOGNIZER_NAME: Record<ModelSource, string> = {
  yours: 'your trained model',
  shipped: 'the trained model shipped with this app',
  'built-in': 'MediaPipe’s built-in gestures',
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState<View>('play')
  const [difficultyId, setDifficultyId] = useState<DifficultyId>('hard')
  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[0]
  const [cheat, setCheat] = useState(false)
  const [mode, setMode] = useState<Mode>('classic')
  const [muted, setMutedState] = useState(isMuted)

  // Gesture recognizer: the player's own trained model, else one shipped with the app, else MediaPipe's.
  const [savedModel, setSavedModel] = useState<GestureModel | null>(loadSavedModel)
  const [shippedModel, setShippedModel] = useState<GestureModel | null>(null)
  useEffect(() => {
    let active = true
    void loadShippedModel().then((model) => active && setShippedModel(model))
    return () => {
      active = false
    }
  }, [])
  const activeModel = savedModel ?? shippedModel
  const modelSource: ModelSource = savedModel ? 'yours' : shippedModel ? 'shipped' : 'built-in'
  const chooseModel = (model: GestureModel | null) => {
    saveModel(model)
    setSavedModel(model)
  }

  // Lizard–Spock needs a recognizer that knows both moves (MediaPipe's built-in gestures don't).
  const lizardSpockAvailable = ['lizard', 'spock'].every((id) => activeModel?.classes.includes(id))
  const activeMode: Mode = lizardSpockAvailable ? mode : 'classic'
  const moves = MODE_MOVES[activeMode]

  const tracking = useHandTracking(videoRef, canvasRef, activeModel)
  const { state: game, history, advance } = useGame(tracking.readingRef, difficulty, cheat, activeMode)
  const ready = tracking.status === 'ready'
  const { phase, beat, reveal, playerMove, score } = game

  // Sound effects: a tick per countdown word, then a jingle for how the round (or match) went.
  useEffect(() => {
    if (phase === 'countdown') playSound(beat === COUNTDOWN.length - 1 ? 'shoot' : 'tick')
  }, [phase, beat])
  useEffect(() => {
    if (!reveal || (phase !== 'result' && phase !== 'match-over')) return
    if (phase === 'match-over') playSound(matchWinner(score) === 'player' ? 'match-win' : 'match-lose')
    else if (!playerMove) playSound('missed')
    else playSound(judge(playerMove, reveal.move))
  }, [phase, reveal, playerMove, score])

  // Space starts/continues the game, so players don't need to reach for the mouse mid-match.
  useEffect(() => {
    if (view !== 'play') return
    const onKeyDown = (e: KeyboardEvent) => {
      // Focused controls already handle Space themselves.
      if (e.code !== 'Space' || e.repeat) return
      if (e.target instanceof Element && e.target.closest('button, summary, input')) return
      e.preventDefault()
      if (ready) advance()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view, ready, advance])

  const playing = view === 'play'

  // The camera stays at the same place in the tree in both views, so switching never restarts it.
  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>
            Rock · Paper · Scissors <span>vs AI</span>
          </h1>
          <p>Best of 5 against the AI. Show your move to the camera on “Shoot!”</p>
        </div>
        <div className="header__controls">
          <button
            type="button"
            className="button button--ghost button--icon"
            aria-pressed={!muted}
            aria-label={muted ? 'Sound off' : 'Sound on'}
            title={muted ? 'Sound off' : 'Sound on'}
            onClick={() => {
              setMuted(!muted)
              setMutedState(!muted)
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <div className="segmented" role="radiogroup" aria-label="View">
          {(['play', 'train'] as const).map((v) => (
            <label key={v} className="segmented__option">
              <input
                type="radio"
                name="view"
                checked={view === v}
                disabled={game.phase === 'countdown'}
                onChange={() => setView(v)}
              />
              <span>{v === 'play' ? '🎮 Play' : '🛠 Train gestures'}</span>
            </label>
          ))}
          </div>
        </div>
      </header>

      {playing && (
        <DifficultyPicker
          difficulty={difficulty}
          onChange={setDifficultyId}
          mode={activeMode}
          onModeChange={setMode}
          lizardSpockAvailable={lizardSpockAvailable}
          cheat={cheat}
          onCheatChange={setCheat}
          // Locked once a match has a scored round, so nobody switches to Easy at 2–2.
          locked={game.phase === 'countdown' || (game.phase === 'result' && game.rounds.length > 0)}
          history={history}
        />
      )}

      {playing && <Scoreboard score={game.score} rounds={game.rounds} />}

      <div className={`arena${playing ? '' : ' arena--train'}`}>
        <CameraView videoRef={videoRef} canvasRef={canvasRef} tracking={tracking}>
          {playing && game.phase === 'countdown' && <Countdown beat={game.beat} />}
        </CameraView>
        {playing ? (
          <AICard
            commitment={game.commitment}
            reveal={reveal}
            outcome={reveal && playerMove ? judge(playerMove, reveal.move) : null}
          />
        ) : (
          <TrainerPanel
            featuresRef={tracking.featuresRef}
            ready={ready}
            handVisible={tracking.reading.gesture !== null}
            activeModel={activeModel}
            source={modelSource}
            onUseModel={chooseModel}
          />
        )}
      </div>

      {playing && (
        <>
          <RoundResult game={game} ready={ready} onAdvance={advance} />
          {phase === 'match-over' && <MatchReport history={history} moves={moves} />}
          {phase === 'match-over' && matchWinner(score) === 'player' && <Confetti />}
          <BrainPanel game={game} history={history} moves={moves} />
          <FairnessProof commitment={game.commitment} reveal={game.reveal} />
        </>
      )}

      <ul className="legend">
        {moves.map((move) => (
          <li key={move}>
            {MOVE_EMOJI[move]} {MOVE_HAND[move]} = {MOVE_LABEL[move]}
          </li>
        ))}
      </ul>
      <p className="recognizer">Recognizing gestures with {RECOGNIZER_NAME[modelSource]}.</p>
    </main>
  )
}
