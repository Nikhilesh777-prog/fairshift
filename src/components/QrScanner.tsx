import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, QrCode } from 'lucide-react';
import { Button, Modal } from './ui';

type DetectedCode = { rawValue: string };
type NativeBarcodeDetector = { detect: (source: HTMLVideoElement) => Promise<DetectedCode[]> };
type BarcodeDetectorConstructor = new (options?: { formats: string[] }) => NativeBarcodeDetector;

export function QrScanner({ title, onScan, onClose }: { title: string; onScan: (value: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null); const stopRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState(''); const [starting, setStarting] = useState(false);
  const stop = () => { stopRef.current?.(); stopRef.current = null; const media = video.current?.srcObject; if (media instanceof MediaStream) media.getTracks().forEach(track => track.stop()); if (video.current) video.current.srcObject = null; };
  const begin = async () => {
    setStarting(true); setError('');
    try {
      const BarcodeDetector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!BarcodeDetector) throw new Error('Camera QR scanning is not available in this browser. You can still simulate a site QR below.');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not available. You can still simulate a site QR below.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!video.current) { stream.getTracks().forEach(track => track.stop()); throw new Error('Camera view is unavailable.'); }
      const element = video.current; element.srcObject = stream; await element.play();
      const detector = new BarcodeDetector({ formats: ['qr_code'] }); let running = true; let scanning = false;
      const timer = window.setInterval(async () => {
        if (!running || scanning || element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        scanning = true;
        try { const results = await detector.detect(element); if (results[0]?.rawValue) { running = false; window.clearInterval(timer); stream.getTracks().forEach(track => track.stop()); onScan(results[0].rawValue); } }
        catch { /* Camera is still active; the user can use the simulation fallback at any time. */ }
        finally { scanning = false; }
      }, 250);
      stopRef.current = () => { running = false; window.clearInterval(timer); stream.getTracks().forEach(track => track.stop()); };
    } catch (problem) { stop(); setError(problem instanceof Error ? problem.message : 'Camera access is unavailable. You can still simulate a site QR below.'); }
    finally { setStarting(false); }
  };
  useEffect(() => () => stop(), []);
  const simulated = () => { stop(); onScan('SIMULATE'); };
  return <Modal title={title} description="Scan the QR code at your work location. Camera permission is only requested when you start scanning." onClose={() => { stop(); onClose(); }}><div className="qr-scanner"><div className="scanner-window"><video ref={video} muted playsInline/><span className="scanner-frame" aria-hidden="true"/><div className="scanner-overlay"><QrCode size={22}/><span>Hold the code in the frame</span></div></div>{error && <div role="status" className="inline-notice notice-amber"><CameraOff size={17}/>{error}</div>}<div className="qr-controls">{!stopRef.current && <Button type="button" variant="secondary" onClick={() => void begin()} disabled={starting}><Camera size={17}/>{starting ? 'Starting camera…' : 'Use camera'}</Button>}<Button type="button" onClick={simulated}><QrCode size={17}/>Simulate QR</Button></div><p className="form-helper">Simulation uses your connected demo site QR.</p></div></Modal>;
}
