import React, { useState } from 'react';
import Viewer3D from './components/Viewer3D';
import { Upload, Activity, Settings } from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [normalization, setNormalization] = useState('min_max');
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('normalization', normalization);

    try {
      const response = await fetch('http://localhost:8000/process-volume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Processing failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setProcessedData(url);
    } catch (error) {
      console.error(error);
      alert('Error processing file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-white font-sans">
      {/* Sidebar */}
      <div className="w-80 border-r border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-8 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            NeuroPET
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Advanced 3D Visualization</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Upload size={16} /> Data Input
            </h2>
            <div className="relative group">
              <input
                type="file"
                accept=".nii,.nii.gz"
                onChange={handleFileChange}
                className="block w-full text-sm text-zinc-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-500/10 file:text-blue-400
                  hover:file:bg-blue-500/20
                  cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Settings size={16} /> Normalization
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setNormalization('min_max')}
                className={`p-3 rounded-lg border text-sm transition-all ${normalization === 'min_max'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                  }`}
              >
                Min-Max
              </button>
              <button
                onClick={() => setNormalization('z_score')}
                className={`p-3 rounded-lg border text-sm transition-all ${normalization === 'z_score'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                  }`}
              >
                Z-Score
              </button>
            </div>
          </div>

          <button
            onClick={handleProcess}
            disabled={!file || loading}
            className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${!file || loading
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/20 hover:scale-[1.02]'
              }`}
          >
            {loading ? (
              <span className="animate-pulse">Processing...</span>
            ) : (
              <>
                <Activity size={18} /> Render 3D Volume
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Viewer */}
      <div className="flex-1 bg-black relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-50 pointer-events-none" />
        {processedData ? (
          <Viewer3D fileUrl={processedData} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-zinc-600">
            <div className="text-center">
              <Activity size={48} className="mx-auto mb-4 opacity-20" />
              <p>Upload and process a file to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
