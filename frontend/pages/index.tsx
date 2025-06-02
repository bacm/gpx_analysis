import { useState } from 'react'
import Head from 'next/head'
import FileUpload from '../components/FileUpload'
import AnalysisResults from '../components/AnalysisResults'
import MapView from '../components/MapView'
import ProgressTracker from '../components/ProgressTracker'
import { Container, Typography, Box, Alert } from '@mui/material'

interface AnalysisResult {
  filename: string
  total_points: number
  problematic_segments: Array<{
    segment_index: number
    point_index: number
    latitude: number
    longitude: number
    elevation: number
    warnings: string[]
    tags_found: Record<string, string>
  }>
  summary: {
    total_warnings: number
    unsuitable_segments: number
    warning_types: Record<string, number>
  }
}

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [enabledWarningTypes, setEnabledWarningTypes] = useState<Set<string>>(new Set())

  const handleFileAnalysis = async (file: File, slopeThreshold: number) => {
    setIsLoading(true)
    setError(null)
    setAnalysisResult(null)
    setAnalysisId(null)
    setEnabledWarningTypes(new Set())

    const formData = new FormData()
    formData.append('file', file)
    formData.append('slope_threshold', slopeThreshold.toString())

    try {
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`)
      }

      const result = await response.json()
      setAnalysisId(result.analysis_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setIsLoading(false)
    }
  }

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result)
    setIsLoading(false)
    setAnalysisId(null)
    // Activer tous les types d'alertes par défaut
    setEnabledWarningTypes(new Set(Object.keys(result.summary.warning_types)))
  }

  const handleAnalysisError = (error: string) => {
    setError(error)
    setIsLoading(false)
    setAnalysisId(null)
  }

  const handleWarningTypeToggle = (warningType: string, isEnabled: boolean) => {
    setEnabledWarningTypes(prev => {
      const newSet = new Set(prev)
      if (isEnabled) {
        newSet.add(warningType)
      } else {
        newSet.delete(warningType)
      }
      return newSet
    })
  }

  return (
    <>
      <Head>
        <title>GPX Road Bike Analyzer</title>
        <meta name="description" content="Analysez vos traces GPX pour le vélo de route" />
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </Head>

      <Container maxWidth="lg">
        <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="h2" component="h1" color="primary" gutterBottom>
            GPX Road Bike Analyzer
          </Typography>

          <Typography variant="h5" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Analysez vos traces GPX pour détecter les segments non adaptés au vélo de route
          </Typography>

          <FileUpload onFileAnalysis={handleFileAnalysis} isLoading={isLoading} />

          {analysisId && (
            <ProgressTracker
              analysisId={analysisId}
              onComplete={handleAnalysisComplete}
              onError={handleAnalysisError}
            />
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {error}
            </Alert>
          )}

          {analysisResult && (
            <Box sx={{ width: '100%', mt: 4 }}>
              <AnalysisResults 
                result={analysisResult} 
                onWarningTypeToggle={handleWarningTypeToggle}
                enabledWarningTypes={enabledWarningTypes}
              />
              <MapView 
                segments={analysisResult.problematic_segments} 
                enabledWarningTypes={enabledWarningTypes}
              />
            </Box>
          )}
        </Box>
      </Container>
    </>
  )
} 