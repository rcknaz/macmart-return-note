import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RefreshCw } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string, name: string) => void;
  onClose: () => void;
}

const LIVE_PRESETS = [
  { barcode: '5010019640166', name: 'Cadbury Dairy Milk Chocolate' },
  { barcode: '5011013149811', name: 'Lipton Yellow Label Tea' },
  { barcode: '4902102072618', name: 'Coca-Cola original 325ml' },
  { barcode: '8801043015042', name: 'Nongshim Shin Ramyun instant noodles' },
  { barcode: '037000305886', name: 'Pringles Sour Cream & Onion' }
];

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [useRealCamera, setUseRealCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [successCode, setSuccessCode] = useState('');
  const [activeCameraName, setActiveCameraName] = useState('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (useRealCamera) {
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [useRealCamera]);

  const startCamera = async (deviceId?: string) => {
    setCameraError('');
    try {
      // Stop old track
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Query active track label (the real camera name!)
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        setActiveCameraName(tracks[0].label || 'Standard Camera');
      }

      // Enumerate other devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        if (videoDevices.length > 0 && !deviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (enumErr) {
        console.warn("Could not enumerate camera devices:", enumErr);
      }
    } catch (err: any) {
      console.warn("Camera block or absent in iframe:", err);
      setCameraError("Camera unavailable or blocked by sandbox permissions. Use the Interactive Simulator below.");
      setUseRealCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleSimulateScan = (item: typeof LIVE_PRESETS[0]) => {
    setSuccessCode(item.barcode);
    setTimeout(() => {
      onScan(item.barcode, item.name);
      setSuccessCode('');
    }, 900);
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 max-w-md w-full mx-auto">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-indigo-455 text-indigo-400 shrink-0" />
          <h4 className="font-semibold text-sm font-sans">Smart Barcode Terminal</h4>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Camera Stage */}
      <div className="relative aspect-video bg-slate-950 flex flex-col items-center justify-center overflow-hidden border-b border-slate-800">
        {useRealCamera ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {/* Active camera name display */}
            <div className="absolute top-2.5 left-2.5 bg-slate-900/85 backdrop-blur-xs text-[10px] text-slate-200 px-2 py-1 rounded-md border border-slate-700/50 flex items-center gap-1.5 font-mono shadow-md z-10">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              🎥 {activeCameraName || 'Active Feed'}
            </div>

            {/* Switch Camera Dropdown if multiple are available */}
            {availableCameras.length > 1 && (
              <div className="absolute bottom-2.5 right-2.5 bg-slate-900/90 text-[10px] rounded-md border border-slate-700/80 overflow-hidden flex items-center pr-1.5 pl-1.5 shadow-md z-10">
                <span className="text-slate-400 font-medium mr-1 font-mono">Camera:</span>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedDeviceId(id);
                    startCamera(id);
                  }}
                  className="bg-transparent text-white outline-hidden cursor-pointer py-1 max-w-[150px] truncate font-medium border-none"
                >
                  {availableCameras.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white text-xs">
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Scanner line overlay */}
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-lg shadow-red-500/50 animate-bounce" />
            <div className="absolute inset-4 border-2 border-dashed border-indigo-500/40 rounded-lg pointer-events-none" />
          </>
        ) : (
          <div className="p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500 border border-slate-700">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-300 font-medium font-mono">INTEGRATED SIMULATOR ACTIVE</p>
              <p className="text-[10px] text-slate-550 text-slate-400 mt-1 max-w-xs mx-auto">
                {cameraError || "Camera permissions restricted inside frame sandboxes. Please tap any preset code to instantly scan."}
              </p>
            </div>
            <button
              onClick={() => setUseRealCamera(true)}
              className="text-xs font-semibold bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Try Real Camera
            </button>
          </div>
        )}

        {/* Scan Success Indicator Overlay */}
        {successCode && (
          <div className="absolute inset-0 bg-indigo-950/90 flex flex-col items-center justify-center text-center space-y-2 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white scale-110 duration-200">
              <Check className="w-6 h-6 stroke-[3px]" />
            </div>
            <div>
              <h5 className="font-bold text-sm">Product Scanned!</h5>
              <p className="font-mono text-xs text-indigo-300 tracking-wider mt-1">{successCode}</p>
            </div>
          </div>
        )}
      </div>

      {/* Preset / Sim Section */}
      <div className="p-4 space-y-3 bg-slate-900/55">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>TAP PRODUCT TO SIMULATE BARCODE SCAN:</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-slate-500" /> Presets</span>
        </div>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
          {LIVE_PRESETS.map((item) => (
            <button
              key={item.barcode}
              onClick={() => handleSimulateScan(item)}
              className="flex items-center justify-between p-2.5 bg-slate-800 hover:bg-indigo-650/30 border border-slate-750 hover:border-indigo-505/40 text-left rounded-xl text-xs transition-all group font-mono cursor-pointer"
            >
              <div>
                <span className="font-sans font-medium text-slate-200 block truncate max-w-[200px] group-hover:text-indigo-400 text-left">
                  {item.name}
                </span>
                <span className="text-[10px] text-slate-500 tracking-wider block text-left">{item.barcode}</span>
              </div>
              <span className="text-[10px] bg-slate-700 group-hover:bg-indigo-600 px-2 py-0.5 rounded-full text-slate-300 group-hover:text-white transition-colors">
                Scan Code
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
