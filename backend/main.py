from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import os
import uuid
import asyncio
from typing import List, Dict, Any, Optional
from gpx_analysis import analyze_gpx_for_road_bike_with_progress

app = FastAPI(title="GPX Road Bike Analyzer", version="1.0.0")

# Configuration CORS pour le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # URL du frontend Next.js
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stockage en mémoire des statuts d'analyse
analysis_status: Dict[str, Dict] = {}

@app.get("/")
async def root():
    return {"message": "GPX Road Bike Analyzer API"}

@app.post("/analyze")
async def analyze_gpx(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    slope_threshold: float = Form(10.0)
):
    """
    Lance l'analyse d'un fichier GPX en arrière-plan
    """
    if not file.filename.endswith('.gpx'):
        raise HTTPException(status_code=400, detail="Le fichier doit être au format .gpx")
    
    # Générer un ID unique pour cette analyse
    analysis_id = str(uuid.uuid4())
    
    try:
        # Sauvegarder temporairement le fichier uploadé
        with tempfile.NamedTemporaryFile(delete=False, suffix='.gpx') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Initialiser le statut
        analysis_status[analysis_id] = {
            "status": "starting",
            "progress": 0,
            "current_step": "Initialisation...",
            "total_points": 0,
            "processed_points": 0,
            "result": None,
            "error": None
        }
        
        # Lancer l'analyse en arrière-plan
        background_tasks.add_task(
            run_analysis_background, 
            analysis_id, 
            temp_file_path, 
            file.filename,
            slope_threshold
        )
        
        return {"analysis_id": analysis_id, "status": "started"}
        
    except Exception as e:
        # Nettoyer le fichier temporaire en cas d'erreur
        if 'temp_file_path' in locals():
            os.unlink(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Erreur lors du démarrage: {str(e)}")

@app.get("/analyze/{analysis_id}/status")
async def get_analysis_status(analysis_id: str):
    """
    Récupère le statut d'une analyse en cours
    """
    if analysis_id not in analysis_status:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    return analysis_status[analysis_id]

def run_analysis_background(
    analysis_id: str, 
    gpx_file_path: str, 
    filename: str,
    slope_threshold: float
):
    """
    Exécute l'analyse en arrière-plan avec mise à jour du statut
    """
    try:
        def progress_callback(step: str, progress: int, total_points: int, processed_points: int):
            print(f"Progress update: {progress}% - {step}")  # Debug
            analysis_status[analysis_id].update({
                "status": "processing",
                "progress": min(100, max(0, progress)),  # S'assurer que progress est entre 0 et 100
                "current_step": step,
                "total_points": total_points,
                "processed_points": processed_points
            })
        
        # Mettre à jour le statut de démarrage
        analysis_status[analysis_id].update({
            "status": "processing",
            "progress": 0,
            "current_step": "Démarrage de l'analyse..."
        })
        
        # Analyser le fichier GPX avec callback de progression
        result = analyze_gpx_for_road_bike_with_progress(
            gpx_file_path, 
            progress_callback,
            slope_threshold_percent=slope_threshold
        )
        
        # Mettre à jour le statut final
        analysis_status[analysis_id].update({
            "status": "completed",
            "progress": 100,
            "current_step": "Analyse terminée",
            "result": result
        })
        
    except Exception as e:
        print(f"Error in analysis: {e}")  # Debug
        analysis_status[analysis_id].update({
            "status": "error",
            "error": str(e)
        })
    finally:
        # Nettoyer le fichier temporaire
        if os.path.exists(gpx_file_path):
            os.unlink(gpx_file_path)

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 