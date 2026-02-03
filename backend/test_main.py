from fastapi.testclient import TestClient
import numpy as np
import nibabel as nib
import os
import sys

# Ensure backend can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

client = TestClient(app)

def test_process_volume_min_max():
    # 1. Create a dummy NIfTI file with known values
    data = np.array([[[0, 50], [100, 150]], [[200, 250], [300, 350]]], dtype=np.float64)
    # Range is 0 to 350.
    # Min-Max should map 0->0, 350->255.
    
    affine = np.eye(4)
    img = nib.Nifti1Image(data, affine)
    
    input_filename = 'test_input.nii'
    output_filename = 'test_output.nii.gz'
    
    nib.save(img, input_filename)
    
    try:
        # 2. Upload and process
        with open(input_filename, 'rb') as f:
            files = {'file': (input_filename, f, 'application/octet-stream')}
            response = client.post("/process-volume", files=files, data={'normalization': 'min_max'})
            
        assert response.status_code == 200
        
        # 3. Verify Output
        with open(output_filename, 'wb') as f:
            f.write(response.content)
            
        out_img = nib.load(output_filename)
        out_data = out_img.get_fdata()
        
        # Check range
        assert out_data.min() == 0
        assert out_data.max() == 255
        
        # Check specific values
        # 0 -> 0
        # 350 -> 255
        # 175 -> ~127.5
        
        # Allow small rounding error
        assert np.abs(out_data[0,0,0] - 0) < 1
        assert np.abs(out_data[1,1,1] - 255) < 1
        
    finally:
        # Cleanup
        if os.path.exists(input_filename):
            os.remove(input_filename)
        if os.path.exists(output_filename):
            os.remove(output_filename)

def test_process_volume_z_score():
    # Create dummy data with specific mean/std
    # Mean 0, Std 1 is easy.
    # [ -3, -1, 0, 1, 3 ]
    data = np.array([[[-3, -1], [0, 1]], [[3, 10], [-10, 0]]], dtype=np.float64)
    # Z-scores:
    # -3 -> -3 (clip -3) -> mapped to 0
    # 3 -> 3 (clip 3) -> mapped to 255
    # 0 -> 0 -> mapped to 127.5
    
    # Note: backend calculates mean/std of the input data.
    # So if I pass [-3, 3], mean is 0, std is 3. 
    # Normalization = (x - 0) / 3.
    # -3 becomes -1. 3 becomes 1.
    # Then clip(-3, 3) -> remains -1, 1.
    # Map: (-1 + 3)/6 * 255 = 2/6 * 255 = 85.
    # Map: (1 + 3)/6 * 255 = 4/6 * 255 = 170.
    
    # To get full range, I need raw z-scores of -3 and 3.
    # If I want mean=0, std=1, I need input to be normalized already or construct it carefully.
    # Let's just verify typical behavior roughly.
    
    affine = np.eye(4)
    img = nib.Nifti1Image(data, affine)
    
    input_filename = 'test_z_input.nii'
    nib.save(img, input_filename)
    
    try:
        with open(input_filename, 'rb') as f:
            files = {'file': (input_filename, f, 'application/octet-stream')}
            response = client.post("/process-volume", files=files, data={'normalization': 'z_score'})
            
        assert response.status_code == 200
        
        # Simply check it returns valid NIfTI
        with open('test_z_out.nii.gz', 'wb') as f:
            f.write(response.content)
            
        out_img = nib.load('test_z_out.nii.gz')
        out_data = out_img.get_fdata()
        
        assert out_data.min() >= 0
        assert out_data.max() <= 255
        
    finally:
         if os.path.exists(input_filename):
            os.remove(input_filename)
         if os.path.exists('test_z_out.nii.gz'):
            os.remove('test_z_out.nii.gz')
