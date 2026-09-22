import { EVENT_CATEGORIES } from '../lib/eventCategories'
import './Legend.css'

export function Legend() {
  return (
    <div className="legend">
      <div><span className="dot human" /> Human</div>
      <div><span className="dot bot" /> Bot</div>
      {EVENT_CATEGORIES.map(({ kind, label, color }) => (
        <div key={kind}><span className="marker" style={{ backgroundColor: color }} /> {label}</div>
      ))}
    </div>
  )
}
