"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
export function AdminDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-label={title}
      className={`max-h-[85dvh] w-[calc(100%_-_32px)] overflow-hidden rounded-lg border border-gray-200 bg-white p-0 text-[#242a30] backdrop:bg-black/40 ${wide ? "max-w-3xl" : "max-w-lg"}`}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 p-5">
          <h2 className="min-w-0 break-words text-lg font-semibold">{title}</h2>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded hover:bg-gray-100"
            title="Close"
            aria-label="Close dialog"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  );
}
