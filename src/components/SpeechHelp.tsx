import { useState } from 'react';
import { Headphones, Volume2 } from 'lucide-react';
import { useSession } from '@/lib/session';
import { Button, Modal } from './ui';
export function SpeechHelp() {
  const [open, setOpen] = useState(false);
  const { language } = useSession();
  const lines = { en: ['Your work, clearly valued.', 'Choose Home, Shifts, Pay, Safety, or Me from the buttons at the bottom.'], hi: ['आपका काम, आपका सम्मान।', 'नीचे दिए होम, शिफ्ट, वेतन, सुरक्षा या मैं बटन चुनें।'], ta: ['உங்கள் உழைப்பு, மதிப்புடன்.', 'கீழே உள்ள முகப்பு, பணிப்பகுதி, ஊதியம், பாதுகாப்பு அல்லது நான் என்பதைத் தேர்ந்தெடுக்கவும்.'] };
  const speak = (line: string) => { if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(line); utterance.lang = language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-US'; window.speechSynthesis.speak(utterance); };
  return <><button className="voice-help" type="button" aria-label="Voice and help" onClick={() => setOpen(true)}><Headphones size={21}/><span>Help</span></button>{open && <Modal title="A hand, when you need it" description="Tap a prompt to hear it in your chosen language." onClose={() => setOpen(false)}><div className="voice-prompts">{lines[language].map(line => <Button variant="secondary" key={line} onClick={() => speak(line)}><Volume2 size={17}/>{line}</Button>)}{!('speechSynthesis' in window) && <p>Your browser does not have voice playback, but the instructions above are ready to read.</p>}</div></Modal>}</>;
}
