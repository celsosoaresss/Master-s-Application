from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import nibabel as nib
import numpy as np
import io
import shutil
import tempfile
import os

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    return {"message": "PET Visualization Backend is running"}

def normalize_data(data: np.ndarray, method: str):
    if method == "min_max":
        min_val = np.min(data)
        max_val = np.max(data)
        if max_val - min_val == 0:
            return np.zeros_like(data, dtype=np.uint8)
        return ((data - min_val) / (max_val - min_val) * 255).astype(np.uint8)
    elif method == "z_score":
        mean = np.mean(data)
        std = np.std(data)
        if std == 0:
            return np.zeros_like(data, dtype=np.uint8)
        z_scored = (data - mean) / std
        # Clip z-score to range [-3, 3] for visualization logic (roughly) or mapped to 0-255
        # Standard Z-score mapping strategy for 8-bit visualization:
        # Map -3 to 0, +3 to 255
        clipped = np.clip(z_scored, -3, 3)
        return ((clipped + 3) / 6 * 255).astype(np.uint8)
    else:
        return data

@app.post("/process-volume")
async def process_volume(file: UploadFile = File(...), normalization: str = Form(...)):
    if not file.filename.endswith(('.nii', '.nii.gz')):
        raise HTTPException(status_code=400, detail="Invalid file format")

    try:
        # Save uploaded file typically to temp to use nibabel
        with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Load NIfTI
        img = nib.load(tmp_path)
        data = img.get_fdata()
        
        # Clean up temp file
        os.remove(tmp_path)

        # Normalize
        processed_data = normalize_data(data, normalization)

        # Create new NIfTI image with processed data (keeping affine)
        new_img = nib.Nifti1Image(processed_data, img.affine, header=img.header)
        
        # Save to temp file to ensure clean NIfTI writing

        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.nii.gz') as out_tmp:
            nib.save(new_img, out_tmp.name)
            out_path = out_tmp.name
        
        with open(out_path, 'rb') as f:
            content = f.read()
            
        os.remove(out_path)
        
        from fastapi.responses import Response
        return Response(content=content, media_type="application/octet-stream")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
