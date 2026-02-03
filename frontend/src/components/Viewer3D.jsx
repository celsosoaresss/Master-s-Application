import React, { useEffect, useRef, useState } from 'react';
import '@kitware/vtk.js/Rendering/Profiles/Volume';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';

import * as nifti from 'nifti-reader-js';

const Viewer3D = ({ fileUrl }) => {
    const vtkContainerRef = useRef(null);
    const context = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!vtkContainerRef.current) return;

        // Initialize VTK
        const genericRenderWindow = vtkGenericRenderWindow.newInstance({
            background: [0, 0, 0],
        });
        genericRenderWindow.setContainer(vtkContainerRef.current);
        genericRenderWindow.resize();

        const renderer = genericRenderWindow.getRenderer();
        const renderWindow = genericRenderWindow.getRenderWindow();

        // Store context
        context.current = {
            genericRenderWindow,
            renderer,
            renderWindow,
            actor: null,
            mapper: null,
        };

        // Clean up
        return () => {
            if (context.current) {
                context.current.genericRenderWindow.delete();
                context.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!fileUrl || !context.current) return;

            setError(null);
            try {
                const response = await fetch(fileUrl);
                const arrayBuffer = await response.arrayBuffer();
                let data = arrayBuffer;

                if (nifti.isCompressed(data)) {
                    data = nifti.decompress(data);
                }

                if (!nifti.isNIFTI(data)) {
                    throw new Error("Invalid NIfTI file");
                }

                const header = nifti.readHeader(data);
                const image = nifti.readImage(header, data);

                // Dimensions
                const dims = header.dims; // [dim, x, y, z, t, ...] (dim=3 or 4)
                // Pixel Dimensions (Spacing)
                const pixDims = header.pixDims; // [?, x, y, z, ...]

                // Create VTK Image Data
                const imageData = vtkImageData.newInstance();
                // nifti dims are 1-based, dims[1] is x
                imageData.setDimensions([dims[1], dims[2], dims[3]]);
                imageData.setSpacing([pixDims[1], pixDims[2], pixDims[3]]);
                // Origin can be qoffset_x etc, but for now 0,0,0
                imageData.setOrigin([0, 0, 0]);

                // Convert image data to TypedArray based on datatype code
                // Header datatype: 2=uint8, 4=int16, 16=float32, etc.
                // But backend forced 8-bit quantization?
                // If backend processed, it should be 8-bit.
                // Let's assume it matches nifti-reader's parsing which returns ArrayBuffer.
                // We need a TypedArray for VTK.
                let typedData;
                if (header.datatypeCode === 2) { // UINT8
                    typedData = new Uint8Array(image);
                } else if (header.datatypeCode === 4) { // INT16
                    typedData = new Int16Array(image);
                } else if (header.datatypeCode === 16) { // FLOAT32
                    typedData = new Float32Array(image);
                } else {
                    // Fallback or assume uint8 if backend promised
                    typedData = new Uint8Array(image);
                }

                const dataArray = vtkDataArray.newInstance({
                    values: typedData,
                    numberOfComponents: 1, // Scalar
                    name: 'Scalars',
                });

                imageData.getPointData().setScalars(dataArray);

                // Create Actor & Mapper
                const mapper = vtkVolumeMapper.newInstance();
                mapper.setInputData(imageData);

                const actor = vtkVolume.newInstance();
                actor.setMapper(mapper);

                // Set up basic transfer functions
                const ctf = vtkColorTransferFunction.newInstance();
                // Map 0 -> Black, 255 -> White (Greyscale for starters)
                // Or a PET heatmap (Blue -> Green -> Red -> Yellow)

                // Simple PET-like heatmap
                ctf.addRGBPoint(0, 0.0, 0.0, 0.0);
                ctf.addRGBPoint(64, 0.0, 0.0, 1.0); // Blue
                ctf.addRGBPoint(128, 0.0, 1.0, 0.0); // Green
                ctf.addRGBPoint(192, 1.0, 0.0, 0.0); // Red
                ctf.addRGBPoint(255, 1.0, 1.0, 0.0); // Yellow

                const of = vtkPiecewiseFunction.newInstance();
                of.addPoint(0, 0.0);
                of.addPoint(10, 0.0); // Remove background
                of.addPoint(255, 1.0);

                actor.getProperty().setRGBTransferFunction(0, ctf);
                actor.getProperty().setScalarOpacity(0, of);

                // Update viewer
                const { renderer, renderWindow } = context.current;
                renderer.removeAllVolumes(); // Clear previous
                renderer.addVolume(actor);
                renderer.resetCamera();
                renderWindow.render();

            } catch (err) {
                console.error(err);
                setError(err.message);
            }
        };

        loadData();
    }, [fileUrl]);

    return (
        <div className="w-full h-full relative">
            <div ref={vtkContainerRef} className="absolute inset-0 w-full h-full" />
            {error && (
                <div className="absolute top-4 left-4 bg-red-500/80 text-white p-2 rounded">
                    Error: {error}
                </div>
            )}
        </div>
    );
};

export default Viewer3D;
