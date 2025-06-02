import gpxpy
import overpy
from typing import List, Dict, Any, Tuple, Callable, Optional
import time
import requests
from shapely.geometry import Point
from shapely.ops import transform
import pyproj
from functools import partial
import math

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calcule la distance en mètres entre deux points géographiques
    en utilisant la formule de Haversine.
    """
    R = 6371000  # Rayon de la Terre en mètres
    
    # Conversion en radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Différences
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    # Formule de Haversine
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return distance

class GPXRoadBikeAnalyzer:
    def __init__(self, progress_callback: Optional[Callable] = None, slope_threshold_percent: float = 10.0):
        self.overpass_api = overpy.Overpass()
        self.search_radius = 50  # mètres autour de chaque point
        self.progress_callback = progress_callback
        self.slope_threshold_percent = slope_threshold_percent
        
    def is_suitable_for_road_bike(self, tags: dict) -> Tuple[bool, List[str]]:
        """
        Détermine si un segment est adapté au vélo de route
        Retourne (bool, List[str]) : (adapté, liste des problèmes)
        """
        warnings = []
        
        # Vérifier la surface
        acceptable_surfaces = ['asphalt', 'paved', 'concrete', 'compacted']

        surface = tags.get('surface', '').lower()

        if surface and surface not in acceptable_surfaces:
            warnings.append(f"Surface non adaptée: {surface}")
        
        # Vérifier le type de route
        unsuitable_highways = ['path', 'bridleway', 'steps']

        highway = tags.get('highway', '').lower()
        if highway == 'track':
            if not surface or surface not in acceptable_surfaces:
                warnings.append(f"Type de voie non adapté: {highway}")
        elif highway == 'footway':
            if not surface or surface not in ['asphalt', 'paved', 'concrete']:
                warnings.append(f"Type de voie non adapté: {highway}")
        elif highway in unsuitable_highways:
            warnings.append(f"Type de voie non adapté: {highway}")

        if highway in unsuitable_highways:
            warnings.append(f"Type de voie non adapté: {highway}")
        
        # Vérifier le grade des pistes
        tracktype = tags.get('tracktype', '').lower()
        if tracktype in ['grade2', 'grade3', 'grade4', 'grade5']:
            warnings.append(f"Qualité de piste faible: {tracktype}")
        
        # Vérifier l'accès vélo
        bicycle = tags.get('bicycle', '').lower()
        if bicycle == 'no':
            warnings.append("Accès vélo interdit")
        
        # Vérifier d'autres indicateurs
        smoothness = tags.get('smoothness', '').lower()
        if smoothness in ['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable']:
            warnings.append(f"Surface en mauvais état: {smoothness}")
        
        # Si aucun problème détecté
        is_suitable = len(warnings) == 0
        
        return is_suitable, warnings
    
    def query_overpass_around_point(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Interroge l'API Overpass autour d'un point donné
        """
        query = f"""
        [out:json][timeout:25];
        (
          way(around:{self.search_radius},{lat},{lon})["highway"];
          way(around:{self.search_radius},{lat},{lon})["surface"];
          way(around:{self.search_radius},{lat},{lon})["tracktype"];
          way(around:{self.search_radius},{lat},{lon})["bicycle"];
        );
        out tags;
        """
        
        try:
            result = self.overpass_api.query(query)
            
            # Agréger tous les tags trouvés
            all_tags = {}
            for way in result.ways:
                all_tags.update(way.tags)
            
            return all_tags
            
        except Exception as e:
            print(f"Erreur Overpass API: {e}")
            return {}
    
    def analyze_gpx_track(self, gpx_file_path: str) -> Dict[str, Any]:
        """
        Analyse complète d'un fichier GPX avec callback de progression
        """
        if self.progress_callback:
            self.progress_callback("Lecture du fichier GPX...", 0, 0, 0)
        
        with open(gpx_file_path, 'r') as gpx_file:
            gpx = gpxpy.parse(gpx_file)
        
        # Compter le nombre total de points à analyser
        total_points_to_analyze = 0
        for track in gpx.tracks:
            for segment in track.segments:
                step = max(1, len(segment.points) // 20)
                total_points_to_analyze += len(range(0, len(segment.points), step))
        
        if self.progress_callback:
            self.progress_callback(
                f"Nombre total de points à analyser: {total_points_to_analyze}", 
                1, 
                total_points_to_analyze, 
                0
            )
        
        analysis_result = {
            "filename": gpx_file_path.split('/')[-1],
            "total_points": 0,
            "problematic_segments": [],
            "summary": {
                "total_warnings": 0,
                "unsuitable_segments": 0,
                "warning_types": {}
            }
        }
        
        segment_index = 0
        processed_points = 0
        
        for track in gpx.tracks:
            for segment in track.segments:
                if self.progress_callback:
                    progress = int((processed_points / max(1, total_points_to_analyze)) * 100)
                    self.progress_callback(
                        f"Analyse du segment {segment_index + 1}...", 
                        progress, 
                        total_points_to_analyze, 
                        processed_points
                    )
                
                points_analyzed = 0
                segment_warnings = []
                
                # Analyser chaque Nème point pour éviter trop de requêtes API
                step = max(1, len(segment.points) // 20)  # Maximum 20 points par segment
                
                for i in range(0, len(segment.points), step):
                    point = segment.points[i]
                    analysis_result["total_points"] += 1
                    points_analyzed += 1
                    processed_points += 1
                    
                    # Mise à jour de la progression - plus fréquente
                    if self.progress_callback:
                        progress = int((processed_points / max(1, total_points_to_analyze)) * 100)
                        self.progress_callback(
                            f"Analyse point {processed_points}/{total_points_to_analyze} - Lat: {point.latitude:.4f}, Lon: {point.longitude:.4f}", 
                            progress, 
                            total_points_to_analyze, 
                            processed_points
                        )
                    
                    # Requête Overpass API
                    tags = self.query_overpass_around_point(point.latitude, point.longitude)
                    
                    # Analyser la compatibilité
                    is_suitable, warnings = self.is_suitable_for_road_bike(tags)
                    
                    # Vérifier la pente avec le point précédent
                    if i > 0 and point.elevation is not None:
                        prev_point = segment.points[i-1]
                        if prev_point.elevation is not None:
                            distance = haversine(
                                prev_point.latitude, prev_point.longitude,
                                point.latitude, point.longitude
                            )
                            
                            if distance >= 2.0:  # Ignorer les points trop proches (bruit GPS)
                                elevation_diff = point.elevation - prev_point.elevation
                                slope_percent = (elevation_diff / distance) * 100
                                
                                if abs(slope_percent) > self.slope_threshold_percent:
                                    warnings.append(f"Pente excessive: {slope_percent:.1f}%")
                    
                    if not is_suitable or warnings:
                        segment_info = {
                            "segment_index": segment_index,
                            "point_index": i,
                            "latitude": point.latitude,
                            "longitude": point.longitude,
                            "elevation": point.elevation,
                            "warnings": warnings,
                            "tags_found": tags
                        }
                        
                        segment_warnings.extend(warnings)
                        analysis_result["problematic_segments"].append(segment_info)
                    
                    # Pause pour éviter de surcharger l'API
                    time.sleep(0.1)
                
                if segment_warnings:
                    analysis_result["summary"]["unsuitable_segments"] += 1
                    for warning in segment_warnings:
                        warning_type = warning.split(':')[0]
                        analysis_result["summary"]["warning_types"][warning_type] = \
                            analysis_result["summary"]["warning_types"].get(warning_type, 0) + 1
                
                segment_index += 1
        
        analysis_result["summary"]["total_warnings"] = len(analysis_result["problematic_segments"])
        
        if self.progress_callback:
            self.progress_callback("Finalisation de l'analyse...", 100, total_points_to_analyze, processed_points)
        
        return analysis_result

def analyze_gpx_for_road_bike(gpx_file_path: str, slope_threshold_percent: float = 10.0) -> Dict[str, Any]:
    """
    Point d'entrée principal pour l'analyse GPX (sans progression)
    
    Args:
        gpx_file_path: Chemin vers le fichier GPX à analyser
        slope_threshold_percent: Seuil de pente en pourcentage au-delà duquel un avertissement est généré (défaut: 10.0)
    """
    analyzer = GPXRoadBikeAnalyzer(slope_threshold_percent=slope_threshold_percent)
    return analyzer.analyze_gpx_track(gpx_file_path)

def analyze_gpx_for_road_bike_with_progress(
    gpx_file_path: str, 
    progress_callback: Callable,
    slope_threshold_percent: float = 10.0
) -> Dict[str, Any]:
    """
    Point d'entrée principal pour l'analyse GPX avec callback de progression
    
    Args:
        gpx_file_path: Chemin vers le fichier GPX à analyser
        progress_callback: Fonction de callback pour suivre la progression
        slope_threshold_percent: Seuil de pente en pourcentage au-delà duquel un avertissement est généré (défaut: 10.0)
    """
    analyzer = GPXRoadBikeAnalyzer(
        progress_callback=progress_callback,
        slope_threshold_percent=slope_threshold_percent
    )
    return analyzer.analyze_gpx_track(gpx_file_path) 