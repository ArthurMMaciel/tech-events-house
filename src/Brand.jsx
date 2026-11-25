import { Sparkles } from 'lucide-react';

export default function Brand() { return <div className="brand"><span className="logo"><Sparkles size={18} strokeWidth={2.4} /></span><span>DFL <b>events</b></span></div>; }

export function Backdrop() { return <div className="backdrop" aria-hidden="true"><span className="orb orb-a" /><span className="orb orb-b" /><span className="orb orb-c" /><span className="grid-lines" /></div>; }
