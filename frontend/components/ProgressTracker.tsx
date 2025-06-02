import { useEffect, useState } from 'react'

interface ProgressData {
  status: string
  progress: number
  current_step: string
  total_points: number
  processed_points: number
  result?: any
  error?: string
}

interface ProgressTrackerProps {
  analysisId: string
  onComplete: (result: any) => void
  onError: (error: string) => void
}

export default function ProgressTracker({ analysisId, onComplete, onError }: ProgressTrackerProps) {
  const [progressData, setProgressData] = useState<ProgressData>({
    status: 'starting',
    progress: 0,
    current_step: 'Initialisation...',
    total_points: 0,
    processed_points: 0
  })

  useEffect(() => {
    console.log('Starting progress tracking for analysis:', analysisId)
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/analyze/${analysisId}/status`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('Progress data received:', data)
        
        setProgressData(data)
        
        if (data.status === 'completed' && data.result) {
          console.log('Analysis completed!')
          clearInterval(pollInterval)
          onComplete(data.result)
        } else if (data.status === 'error') {
          console.log('Analysis error:', data.error)
          clearInterval(pollInterval)
          onError(data.error || 'Erreur inconnue')
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du statut:', error)
      }
    }, 500) // Polling plus fréquent pour voir les changements

    return () => {
      console.log('Cleaning up progress tracker')
      clearInterval(pollInterval)
    }
  }, [analysisId, onComplete, onError])

  const getStatusMessage = () => {
    switch (progressData.status) {
      case 'starting':
        return 'Démarrage de l\'analyse...'
      case 'processing':
        return 'Analyse en cours...'
      case 'completed':
        return 'Analyse terminée !'
      case 'error':
        return 'Erreur lors de l\'analyse'
      default:
        return 'Statut inconnu'
    }
  }

  const getProgressColor = () => {
    if (progressData.status === 'error') return '#dc3545'
    if (progressData.status === 'completed') return '#28a745'
    return '#007bff'
  }

  return (
    <div className="progress-container">
      <div className="progress-header">
        <h3>{getStatusMessage()}</h3>
        <span className="progress-percentage">{Math.round(progressData.progress)}%</span>
      </div>
      
      <div className="progress-bar-container">
        <div 
          className="progress-bar"
          style={{ 
            width: `${progressData.progress}%`,
            backgroundColor: getProgressColor()
          }}
        />
      </div>
      
      <div className="progress-details">
        <p className="current-step">{progressData.current_step}</p>
        {progressData.total_points > 0 && (
          <p className="points-info">
            Points traités: {progressData.processed_points} / {progressData.total_points}
          </p>
        )}
        <p className="status-debug">
          Statut: {progressData.status} | ID: {analysisId.substring(0, 8)}...
        </p>
      </div>

      <style jsx>{`
        .progress-container {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          margin: 2rem 0;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 600px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .progress-header h3 {
          margin: 0;
          color: #333;
        }

        .progress-percentage {
          font-size: 1.2rem;
          font-weight: bold;
          color: ${getProgressColor()};
        }

        .progress-bar-container {
          width: 100%;
          height: 20px;
          background-color: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .progress-bar {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 10px;
        }

        .progress-details {
          text-align: center;
        }

        .current-step {
          font-weight: 500;
          color: #666;
          margin: 0.5rem 0;
        }

        .points-info {
          font-size: 0.9rem;
          color: #888;
          margin: 0.5rem 0;
        }

        .status-debug {
          font-size: 0.8rem;
          color: #aaa;
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  )
} 