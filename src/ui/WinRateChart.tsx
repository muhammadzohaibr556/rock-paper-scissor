import { useEffect, useMemo, useRef } from 'react'
import {
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartDataset,
  type ChartOptions,
  type Plugin,
} from 'chart.js'
import { MOVE_EMOJI } from '../game/moves.ts'
import type { Round } from '../game/rules.ts'

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip)
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Each point is the AI's win rate over this many rounds (fewer at the very start). */
const WINDOW = 10

interface Point {
  x: number
  y: number
  /** First round counted in this point's window. */
  from: number
}

interface Theme {
  series: string
  grid: string
  axis: string
  muted: string
  text: string
  surface: string
  border: string
}

/** The AI's win rate (%) over the last WINDOW rounds, at every round of the session. */
function rollingWinRate(history: readonly Round[]): Point[] {
  return history.map((_, i) => {
    const from = Math.max(0, i + 1 - WINDOW)
    const recent = history.slice(from, i + 1)
    const aiWins = recent.filter((round) => round.outcome === 'lose').length
    return { x: i + 1, y: Math.round((aiWins / recent.length) * 100), from: from + 1 }
  })
}

function readTheme(element: Element): Theme {
  const css = getComputedStyle(element)
  const value = (name: string) => css.getPropertyValue(name).trim()
  return {
    series: value('--chart-series'),
    grid: value('--chart-grid'),
    axis: value('--chart-axis'),
    muted: value('--chart-muted'),
    text: value('--text'),
    surface: value('--surface'),
    border: value('--border'),
  }
}

interface WinRateChartProps {
  history: readonly Round[]
  /** The AI's win rate against a random player: 1/3, or 2/5 with Lizard and Spock (each move beats two of five). */
  chance: number
}

export function WinRateChart({ history, chance }: WinRateChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart<'line', Point[]> | null>(null)
  const themeRef = useRef<Theme | null>(null)
  // Read by the chance-line plugin when it draws.
  const chanceRef = useRef(chance)
  const points = useMemo(() => rollingWinRate(history), [history])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    themeRef.current = readTheme(canvas)
    const theme = () => themeRef.current ?? readTheme(canvas)

    // A solid hairline at chance: above it the AI is beating luck. (Labelled in the caption below the
    // chart, since any spot inside the plot can collide with the line.)
    const chanceLine: Plugin<'line'> = {
      id: 'chanceLine',
      beforeDatasetsDraw({ ctx, chartArea, scales }) {
        const y = scales.y.getPixelForValue(chanceRef.current * 100)
        ctx.save()
        ctx.strokeStyle = theme().muted
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(chartArea.left, y)
        ctx.lineTo(chartArea.right, y)
        ctx.stroke()
        ctx.restore()
      },
    }

    // Vertical hairline that follows the hovered round.
    const crosshair: Plugin<'line'> = {
      id: 'crosshair',
      afterDatasetsDraw(chart) {
        const active = chart.tooltip?.getActiveElements()
        if (!active?.length) return
        const { ctx, chartArea } = chart
        ctx.save()
        ctx.strokeStyle = theme().axis
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(active[0].element.x, chartArea.top)
        ctx.lineTo(active[0].element.x, chartArea.bottom)
        ctx.stroke()
        ctx.restore()
      },
    }

    // The latest value, written beside the line's end.
    const endLabel: Plugin<'line'> = {
      id: 'endLabel',
      afterDatasetsDraw(chart) {
        const elements = chart.getDatasetMeta(0).data
        const last = elements.at(-1)
        const value = chart.data.datasets[0].data.at(-1) as Point | undefined
        if (!last || !value) return
        const { ctx } = chart
        ctx.save()
        ctx.fillStyle = theme().text
        ctx.font = `600 13px ${Chart.defaults.font.family}`
        ctx.textBaseline = 'middle'
        ctx.fillText(`${value.y}%`, last.x + 9, last.y)
        ctx.restore()
      },
    }

    // Built with the full config: the constructor renders straight away, and Chart.js's default
    // (category) x-axis isn't registered.
    const chart = new Chart<'line', Point[]>(canvas, {
      type: 'line',
      data: { datasets: [datasetConfig(theme(), [])] },
      options: chartOptions(theme(), []),
      plugins: [chanceLine, crosshair, endLabel],
    })
    chartRef.current = chart

    const media = matchMedia('(prefers-color-scheme: dark)')
    const onSchemeChange = () => {
      themeRef.current = readTheme(canvas)
      update(chart, themeRef.current, chart.data.datasets[0].data)
    }
    media.addEventListener('change', onSchemeChange)
    return () => {
      media.removeEventListener('change', onSchemeChange)
      chart.destroy()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    const theme = themeRef.current
    chanceRef.current = chance
    if (chart && theme) update(chart, theme, points)
  }, [points, chance])

  return (
    <>
      <div className="chart">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            points.length
              ? `AI win rate over the last ${WINDOW} rounds is ${points.at(-1)!.y}% after ${points.length} rounds.`
              : 'No rounds played yet.'
          }
        />
        {points.length === 0 && <p className="chart__empty">Play a few rounds to see whether the AI is learning you.</p>}
      </div>
      <p className="chart__caption">
        Each point is the AI’s win rate over the {WINDOW} rounds up to it. The gray line is what it would win by
        luck ({Math.round(chance * 100)}%): above it, the AI is reading you.
      </p>
      {points.length > 0 && <RoundsTable history={history} points={points} />}
    </>
  )
}

function update(chart: Chart<'line', Point[]>, theme: Theme, points: Point[]) {
  chart.data.datasets[0] = datasetConfig(theme, points)
  chart.options = chartOptions(theme, points)
  chart.update()
}

function datasetConfig(theme: Theme, points: Point[]): ChartDataset<'line', Point[]> {
  return {
    data: points,
    borderColor: theme.series,
    borderWidth: 2,
    borderJoinStyle: 'round',
    borderCapStyle: 'round',
    // Smooth, but never overshoots past the real values (e.g. below 0%).
    cubicInterpolationMode: 'monotone',
    // Only the latest point gets a dot (8px, with a 2px ring in the surface color).
    pointRadius: (ctx) => (ctx.dataIndex === points.length - 1 ? 4 : 0),
    pointBackgroundColor: theme.series,
    pointBorderColor: theme.surface,
    pointBorderWidth: 2,
    pointHoverRadius: 5,
    pointHoverBorderWidth: 2,
    pointHitRadius: 12,
  }
}

function chartOptions(theme: Theme, points: Point[]): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    layout: { padding: { top: 8, right: 44 } },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        type: 'linear',
        min: 1,
        max: Math.max(WINDOW, points.length),
        ticks: { precision: 0, maxTicksLimit: 8, color: theme.muted },
        grid: { display: false },
        border: { color: theme.axis },
        title: { display: true, text: 'Round', color: theme.muted },
      },
      y: {
        min: 0,
        max: 100,
        ticks: { stepSize: 25, color: theme.muted, callback: (value) => `${value}%` },
        grid: { color: theme.grid, lineWidth: 1 },
        border: { display: false },
      },
    },
    plugins: {
      tooltip: {
        displayColors: false,
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 10,
        titleColor: theme.text,
        titleFont: { weight: 'bold', size: 14 },
        bodyColor: theme.muted,
        callbacks: {
          // Value first, then what it means.
          title: (items) => `${(items[0].raw as Point).y}% AI wins`,
          label: (item) => {
            const { x, from } = item.raw as Point
            return from === x ? `Round ${x}` : `Rounds ${from}–${x}`
          },
        },
      },
    },
  }
}

/** The same data as a table, so nothing depends on reading the chart. */
function RoundsTable({ history, points }: { history: readonly Round[]; points: Point[] }) {
  return (
    <details className="chart__table">
      <summary>Show as table</summary>
      <div className="chart__table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Round</th>
              <th scope="col">You</th>
              <th scope="col">AI</th>
              <th scope="col">Winner</th>
              <th scope="col">AI win rate (last {WINDOW})</th>
            </tr>
          </thead>
          <tbody>
            {history.map((round, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{MOVE_EMOJI[round.player]}</td>
                <td>{MOVE_EMOJI[round.ai]}</td>
                <td>{round.outcome === 'win' ? 'You' : round.outcome === 'lose' ? 'AI' : 'Draw'}</td>
                <td>{points[i].y}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
