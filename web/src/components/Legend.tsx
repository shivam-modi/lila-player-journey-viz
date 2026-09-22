import './Legend.css'

export function Legend() {
  return (
    <div className="legend">
      <div><span className="dot human" /> Human</div>
      <div><span className="dot bot" /> Bot</div>
      <div><span className="marker kill" /> Kill</div>
      <div><span className="marker death" /> Death</div>
      <div><span className="marker storm" /> Storm death</div>
      <div><span className="marker loot" /> Loot</div>
    </div>
  )
}
