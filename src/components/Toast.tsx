/** 底部居中 toast（tabbar 之上，pointer-events: none，不压内容列中部）。 */
export function Toast({ toast }: { toast: { id: number; text: string } | null }) {
  if (!toast) return null;
  return (
    <div className="toast-wrap">
      <div className="toast" key={toast.id} role="status" aria-live="polite">
        {toast.text}
      </div>
    </div>
  );
}