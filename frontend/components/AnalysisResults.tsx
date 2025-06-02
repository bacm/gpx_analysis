import { useCallback } from 'react'
import { 
  Paper, 
  Typography, 
  Box, 
  List, 
  ListItem, 
  ListItemText,
  Checkbox,
  FormControlLabel
} from '@mui/material'

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

interface AnalysisResultsProps {
  result: AnalysisResult
  onWarningTypeToggle: (warningType: string, isEnabled: boolean) => void
  enabledWarningTypes: Set<string>
}

export default function AnalysisResults({ 
  result, 
  onWarningTypeToggle,
  enabledWarningTypes 
}: AnalysisResultsProps) {
  const handleCheckboxChange = useCallback((warningType: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onWarningTypeToggle(warningType, e.target.checked)
  }, [onWarningTypeToggle])

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        Résultats de l'analyse
      </Typography>
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Résumé
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 2,
          '& > *': {
            flex: '1 1 200px',
            minWidth: '200px'
          }
        }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Fichier
            </Typography>
            <Typography variant="body1">
              {result.filename}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Points analysés
            </Typography>
            <Typography variant="body1">
              {result.total_points}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Segments problématiques
            </Typography>
            <Typography variant="body1">
              {result.summary.unsuitable_segments}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Total d'alertes
            </Typography>
            <Typography variant="body1">
              {result.summary.total_warnings}
            </Typography>
          </Paper>
        </Box>
      </Box>

      {Object.keys(result.summary.warning_types).length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Types d'alertes détectées
          </Typography>
          <List>
            {Object.entries(result.summary.warning_types).map(([type, count]) => (
              <ListItem
                key={type}
                sx={{
                  bgcolor: 'warning.light',
                  mb: 1,
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'warning.main',
                  }
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={enabledWarningTypes.has(type)}
                      onChange={handleCheckboxChange(type)}
                      sx={{ mr: 1 }}
                    />
                  }
                  label={
                    <ListItemText
                      primary={
                        <Typography variant="body1">
                          <strong>{type}:</strong> {count} occurrence(s)
                        </Typography>
                      }
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Paper>
  )
} 