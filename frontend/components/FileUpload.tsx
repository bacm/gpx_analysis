import { useState, useCallback } from 'react'
import { 
  Box, 
  Paper, 
  Typography, 
  CircularProgress,
  TextField,
  InputLabel,
  FormControl
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'

interface FileUploadProps {
  onFileAnalysis: (file: File, slopeThreshold: number) => void
  isLoading: boolean
}

export default function FileUpload({ onFileAnalysis, isLoading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [slopeThreshold, setSlopeThreshold] = useState(10.0)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.gpx')) {
        onFileAnalysis(file, slopeThreshold)
      } else {
        alert('Veuillez sélectionner un fichier .gpx')
      }
    }
  }, [onFileAnalysis, slopeThreshold])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      onFileAnalysis(file, slopeThreshold)
    }
  }, [onFileAnalysis, slopeThreshold])

  const handleSlopeThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value) && value > 0) {
      setSlopeThreshold(value)
    }
  }, [])

  return (
    <Box sx={{ width: '100%', maxWidth: 500, my: 2 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 2, 
          mb: 2,
          backgroundColor: 'background.paper'
        }}
      >
        <FormControl fullWidth>
          <TextField
            id="slope-threshold"
            label="Seuil de pente (%)"
            type="number"
            value={slopeThreshold}
            onChange={handleSlopeThresholdChange}
            inputProps={{
              min: 0.1,
              max: 100,
              step: 0.1
            }}
            disabled={isLoading}
            fullWidth
          />
        </FormControl>
      </Paper>

      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          backgroundColor: dragActive ? 'action.hover' : 'background.paper',
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'divider',
          '&:hover': {
            backgroundColor: dragActive ? 'action.hover' : 'action.hover',
            borderColor: 'primary.main'
          },
          opacity: isLoading ? 0.7 : 1,
          transition: 'all 0.3s ease'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          accept=".gpx"
          onChange={handleChange}
          disabled={isLoading}
          style={{ display: 'none' }}
        />
        <label htmlFor="file-upload" style={{ cursor: 'inherit', width: '100%' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography>Analyse en cours...</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Glissez votre fichier .gpx ici ou cliquez pour sélectionner
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Format accepté: .gpx
              </Typography>
            </Box>
          )}
        </label>
      </Paper>
    </Box>
  )
} 