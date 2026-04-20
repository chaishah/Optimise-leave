const Modal = ({ open, title, children, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Back' }) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-6 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-floatup rounded-2xl border border-l3 bg-l1 p-7 shadow-elevated">
        <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-primary">{title}</h2>
        <div className="mt-3 text-sm leading-relaxed text-sand/70">{children}</div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="w-full rounded-xl border border-l3 bg-l2 px-5 py-3 text-xs font-medium uppercase tracking-[0.25em] text-sand/60 transition-colors hover:text-sand/90"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="w-full rounded-xl bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-ink shadow-glow transition-opacity hover:opacity-90"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Modal
