import { Link } from 'react-router-dom'

export default function Commercial() {
  return (
    <div>
      <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
        🚧 Module en cours de finalisation.
      </div>
      <div className="mt-8">
        <Link to="/app" className="text-blue-600 hover:underline">← Retour au Dashboard</Link>
      </div>
    </div>
  )
}
