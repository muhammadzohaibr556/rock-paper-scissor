# ✊✋✌️ Rock · Paper · Scissors vs AI

A browser game where you play Rock-Paper-Scissors with your **hand on your webcam** against an AI that **learns your habits** and tries to predict your next move. Humans are bad at being random, and the AI knows it.

The AI also **proves it never cheats**: it commits to its move with a cryptographic hash before every countdown.

**▶ Play it now: [muhammadzohaibr556.github.io/rock-paper-scissor](https://muhammadzohaibr556.github.io/rock-paper-scissor/)**

## 🎬 Demo

[![Watch the walkthrough on YouTube](https://img.youtube.com/vi/UGIsS9Y-8Oo/hqdefault.jpg)](https://youtu.be/UGIsS9Y-8Oo)

**[Watch the 5-minute narrated walkthrough on YouTube](https://youtu.be/UGIsS9Y-8Oo)**: how to play and every feature, step by step.

## ✨ Features

| | Feature | What it does |
|---|---|---|
| ✋ | **Webcam hand tracking** | MediaPipe finds your hand and recognizes your gesture live, with a confidence score and a hand skeleton overlay. No controller needed. |
| 🧠 | **An AI that learns you** | Four prediction strategies try to guess your next move. Hard mode runs them all and trusts whichever has been reading you best lately. |
| 🎚 | **Three difficulty levels** | **Easy** plays at random, **Medium** counters your favourite move, **Hard** uses the full ensemble. |
| 🔐 | **Provably fair** | Before each countdown the AI publishes a SHA-256 hash of its move. After the round it reveals the move and secret, so anyone can check it didn't change its move after seeing yours. |
| 📊 | **AI brain panel** | After each round, see what the AI predicted, which strategy it trusted, how accurate each strategy is on you, and a live chart of its win rate. |
| 📋 | **Post-match report** | Your strongest habits, e.g. *"After losing, you played ✊ Rock 80% of the time"*. Only patterns too strong to be luck are shown. |
| 🛠 | **Train your own gestures** | Record samples of your own hands and train a small neural network right in the browser with TensorFlow.js. |
| 🦎🖖 | **Lizard–Spock mode** | Teach the game two extra gestures to unlock Rock-Paper-Scissors-Lizard-Spock, where every move beats two others. |
| 😈 | **Cheat mode (a joke)** | The AI peeks at your hand and always wins, and the fairness proof catches it every time. |
| 🔊 | **Sounds & animations** | Countdown ticks, win/lose jingles (with a mute button), a flipping card, score bumps and confetti. Respects "reduce motion". |

## 🎮 How to play

1. Open the game and **allow camera access** (it works on desktop and phone).
2. Pick a difficulty: **Easy**, **Medium** or **Hard**.
3. Press **Start match**, or the **Space** bar.
4. On **"Rock… Paper… Scissors… Shoot!"**, show your move and hold it for a moment:

   | Move | Hand |
   |---|---|
   | ✊ Rock | Fist |
   | ✋ Paper | Open palm |
   | ✌️ Scissors | Index and middle finger out |
   | 🦎 Lizard | Sock-puppet hand *(Lizard–Spock mode)* |
   | 🖖 Spock | Vulcan salute *(Lizard–Spock mode)* |

5. Matches are **best of 5**: first to 3 round wins.
6. Keep playing. The AI keeps learning across matches, so watch the **AI brain** panel and the report to see how predictable you are.

> **Tip:** if a round says it didn't catch your move, keep your whole hand in view and hold the gesture just after "Shoot!".

## 🧠 How the AI works

Each predictor looks at your past rounds and estimates how likely you are to throw each move next:

| Predictor | Spots habits like… |
|---|---|
| **Frequency** | "You play rock 45% of the time." |
| **Markov chain** | "After rock, you usually play scissors." |
| **Pattern detector** | Repeating sequences of 2–4 moves (n-grams). |
| **Psychology** | Starts from typical human behaviour (winners repeat, losers switch to what would have beaten them), then learns how *you* react to winning, losing and drawing. |

The AI then plays the move with the **best expected score** against that prediction. This isn't always just the counter to your likeliest move, because it also weighs the risk of losing.

**Hard mode** replays recent rounds and scores every predictor on how its advice *would* have done (recent rounds count most). It follows the best one, and plays at random until one proves itself, so it can't be exploited while it's still learning.

In tests against scripted players, each predictor beats the style it was designed for, and none of them can beat a truly random player. That's the point: the only way to beat the AI is to be unpredictable.

### 🔐 The fairness proof

1. Before the countdown, the AI picks its move and a random secret, then publishes `SHA-256("move:secret")`.
2. After the round it reveals the move and secret.
3. The game recomputes the hash, and you can too:

   ```bash
   printf %s 'paper:40d14205d5f8dab60f2d3357e1dae82e' | shasum -a 256
   ```

The secret stops anyone from guessing the move from the hash, since there would otherwise be only three possible hashes. The AI's move and its reasoning stay out of the UI until the reveal.

## 🛠 Training your own gesture model

Open the **Train gestures** tab:

1. Press **Record 5 s** for each gesture (about 200 samples each works well). Tilt and turn your hand, move it closer and farther, and switch hands.
2. Optionally record **Not a move** (thumbs up, pointing…) so other hand shapes aren't forced into a move, and **Lizard** / **Spock** to unlock the five-move mode.
3. Press **Train model**. A small neural network trains in your browser in a few seconds, and is tested on samples it never saw.
4. Press **Use this model**.

Hand landmarks are normalized for position, size, rotation and left/right hand, so tilted hands are recognized too. Your model and samples are saved in your browser. You can export your samples to combine them with friends', or download the model.

**To ship a model with the app for everyone**, save the downloaded file as `public/models/gesture-model.json`. The game uses it whenever a player hasn't trained their own.

## 🧰 Tech stack

| Part | Technology |
|---|---|
| UI | React 19, TypeScript, Vite |
| Hand tracking | [MediaPipe](https://ai.google.dev/edge/mediapipe) Gesture Recognizer (WASM, runs in the browser) |
| Custom gestures | TensorFlow.js (training only, loaded on demand); the game runs the trained network in plain JavaScript |
| Move prediction | Plain TypeScript (frequency, Markov, n-gram, psychology, ensemble) |
| Charts | Chart.js |
| Fairness proof | Web Crypto API (SHA-256) |
| Sound | Web Audio API (synthesized, no audio files) |
| Tests & lint | Vitest, oxlint |
| Hosting | GitHub Pages via GitHub Actions |

## 🚀 Run it locally

You need **Node.js 22.12 or newer** (24 LTS recommended, the version the deploy uses) and a webcam.

```bash
git clone https://github.com/muhammadzohaibr556/rock-paper-scissor.git
cd rock-paper-scissor
npm install
npm run dev
```

Then open **http://localhost:5173**. Browsers only allow the camera on `localhost` or HTTPS.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the test suite (68 tests: game rules, predictors, report, fairness, hand features, training) |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |

## 📦 Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It installs dependencies, lints, runs the tests, builds, and publishes to GitHub Pages. If a test fails, the live site isn't touched.

GitHub Pages serves the app at `/<repo-name>/`, which the workflow passes to Vite as `BASE_PATH`. On hosts that serve from the root (Vercel, Netlify), no setting is needed.

## 📁 Project structure

```
src/
├── ai/          Predictors, ensemble, difficulty levels, habit report (+ tests)
├── fairness/    SHA-256 commit-reveal proof
├── game/        Rules (incl. Lizard-Spock), game loop, move capture
├── vision/      Camera, MediaPipe, hand features, gesture model & training (+ tests)
├── ui/          React components: camera, AI card, brain panel, chart, trainer, sounds…
├── App.tsx
└── index.css
```

## 🔒 Privacy

Everything runs **in your browser**. Your camera feed is processed on your device and never uploaded. The only things downloaded are the app itself and MediaPipe's hand model, from Google's servers. Trained models and samples are stored in your browser's local storage.

## 🙏 Credits

- Hand tracking by [MediaPipe](https://ai.google.dev/edge/mediapipe) (Google)
- Neural network training with [TensorFlow.js](https://www.tensorflow.org/js)
- Demo narration voice: Ethan, via [Fish Audio](https://fish.audio)
- Rock-Paper-Scissors-Lizard-Spock was invented by Sam Kass and Karen Bryla
