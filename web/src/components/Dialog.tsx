import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export default function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
    {children}
  </dialog>;
}
