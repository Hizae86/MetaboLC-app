import os
import json
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Method
import tempfile

router = APIRouter()

def parse_cdf(filepath: str) -> dict:
    """Parse AIA/ANDI CDF chromatogram file"""
    try:
        from scipy.io import netcdf_file
        with netcdf_file(filepath, 'r', mmap=False) as f:
            # Extract time and intensity arrays
            # AIA format standard variable names
            time_values = None
            intensity_values = None

            vars_list = list(f.variables.keys())
            print(f"Available variables: {vars_list}")

            # Try standard AIA variable names
            for time_key in ['scan_acquisition_time', 'time_values', 'retention_time']:
                if time_key in f.variables:
                    time_values = f.variables[time_key].data.copy().astype(float)
                    break

            for int_key in ['intensity_values', 'total_intensity', 'tic', 'ordinate_values']:
                if int_key in f.variables:
                    intensity_values = f.variables[int_key].data.copy().astype(float)
                    break

            # If no time array, reconstruct from sampling interval and delay
            if time_values is None and intensity_values is not None:
                if 'actual_sampling_interval' in f.variables and 'actual_delay_time' in f.variables:
                    interval = float(f.variables['actual_sampling_interval'].data)
                    delay = float(f.variables['actual_delay_time'].data)
                    n = len(intensity_values)
                    time_values = np.array([delay + i * interval for i in range(n)])
                else:
                    raise ValueError(f"Could not reconstruct time axis. Variables: {vars_list}")

            if time_values is None or intensity_values is None:
                raise ValueError(f"Could not find time/intensity data. Variables: {vars_list}")

            # Convert time to minutes if in seconds
            if time_values.max() > 1000:
                time_values = time_values / 60.0

            # Normalize and downsample if too many points
            total_points = len(time_values)
            max_points = 2000
            if total_points > max_points:
                step = total_points // max_points
                time_values = time_values[::step]
                intensity_values = intensity_values[::step]

            # Build trace
            trace = [
                {"rt": round(float(t), 4), "intensity": round(float(i), 2)}
                for t, i in zip(time_values, intensity_values)
            ]

            # Extract metadata
            metadata = {}
            for attr in f._attributes:
                try:
                    val = f._attributes[attr]
                    if isinstance(val, bytes):
                        val = val.decode('utf-8', errors='ignore').strip()
                    metadata[attr] = val
                except:
                    pass

            # Calculate stats
            max_intensity = float(np.max(intensity_values))
            max_idx = int(np.argmax(intensity_values))
            apex_rt = float(time_values[max_idx])

            return {
                "trace": trace,
                "metadata": metadata,
                "stats": {
                    "total_points": len(trace),
                    "rt_start": round(float(time_values[0]), 4),
                    "rt_end": round(float(time_values[-1]), 4),
                    "max_intensity": round(max_intensity, 2),
                    "apex_rt": round(apex_rt, 4),
                    "baseline": round(float(np.percentile(intensity_values, 5)), 2),
                }
            }
    except Exception as e:
        raise ValueError(f"Error parsing CDF: {str(e)}")


@router.post("/methods/{method_id}/chromatogram")
async def upload_chromatogram(
    method_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    method = db.query(Method).filter(Method.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")

    if not file.filename.lower().endswith('.cdf'):
        raise HTTPException(status_code=400, detail="Only .cdf files are supported")

    # Save temp file
    with tempfile.NamedTemporaryFile(suffix='.cdf', delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = parse_cdf(tmp_path)

        # Save JSON to disk
        chrom_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'chromatograms')
        os.makedirs(chrom_dir, exist_ok=True)
        chrom_path = os.path.join(chrom_dir, f"method_{method_id}.json")

        with open(chrom_path, 'w') as f:
            json.dump(result, f)

        return JSONResponse({
            "success": True,
            "method_id": method_id,
            "filename": file.filename,
            "stats": result["stats"],
            "points": len(result["trace"])
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        os.unlink(tmp_path)


@router.get("/methods/{method_id}/chromatogram")
def get_chromatogram(method_id: int):
    chrom_path = os.path.join(
        os.path.dirname(__file__), '..', '..', 'chromatograms',
        f"method_{method_id}.json"
    )
    if not os.path.exists(chrom_path):
        raise HTTPException(status_code=404, detail="No chromatogram uploaded for this method")

    with open(chrom_path) as f:
        data = json.load(f)

    return data
