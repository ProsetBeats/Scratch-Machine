type CutFaderProps = {
  value: number
  onChange: (value: number) => void
}

export function CutFader({ value, onChange }: CutFaderProps) {
  return (
    <div className="cut-fader-wrap">
      <span className="cut-label">CUT</span>
      <input
        className="cut-fader"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}
