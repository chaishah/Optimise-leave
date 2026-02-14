const Modal = ({ open, title, children, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Back' }) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-acid/50 bg-ink/95 p-6 shadow-loud animate-floatup">
        <h2 className="font-display text-2xl text-acid">{title}</h2>
        <div className="mt-3 text-sand/80">{children}</div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="w-full rounded-full border border-white/20 px-5 py-3 text-sm uppercase tracking-widest text-sand/70"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="w-full rounded-full bg-acid px-5 py-3 text-sm font-semibold uppercase tracking-widest text-ink"
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
