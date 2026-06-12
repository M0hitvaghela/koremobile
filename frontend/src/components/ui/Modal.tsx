import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';

interface ModalProps {
  // Accept both `open` and `isOpen` for backwards compat
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  dark?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  dark,
}: ModalProps) {
  const visible = open ?? isOpen ?? false;

  useEffect(() => {
    if (visible) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[80]"
          />

          <div className="fixed inset-0 z-[81] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className={`w-full ${sizes[size]} rounded-xl shadow-2xl pointer-events-auto max-h-[90vh] flex flex-col ${
                dark
                  ? 'bg-adminSurf text-white border border-adminBorder'
                  : 'bg-white text-ink'
              }`}
            >
              {title && (
                <div
                  className={`flex items-center justify-between p-5 border-b ${
                    dark ? 'border-adminBorder' : 'border-gray-100'
                  }`}
                >
                  <h3 className="font-heading font-semibold text-lg">{title}</h3>
                  <button
                    onClick={onClose}
                    className={`rounded-lg p-1.5 ${
                      dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                    }`}
                    aria-label="Close"
                  >
                    <XIcon size={18} />
                  </button>
                </div>
              )}
              <div className="p-5 overflow-y-auto">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}