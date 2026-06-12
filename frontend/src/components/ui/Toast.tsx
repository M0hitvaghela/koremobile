import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2Icon,
  XCircleIcon,
  InfoIcon,
  AlertTriangleIcon,
  XIcon } from
'lucide-react';
import { useToastStore } from '../../store/toastStore';
const variantStyles: Record<
  string,
  {
    bg: string;
    icon: React.ReactNode;
  }> =
{
  success: {
    bg: 'bg-success text-white',
    icon: <CheckCircle2Icon size={20} />
  },
  error: {
    bg: 'bg-red-600 text-white',
    icon: <XCircleIcon size={20} />
  },
  info: {
    bg: 'bg-primary text-white',
    icon: <InfoIcon size={20} />
  },
  warning: {
    bg: 'bg-amber-500 text-white',
    icon: <AlertTriangleIcon size={20} />
  }
};
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((t) => {
          const v = variantStyles[t.variant] || variantStyles.info;
          return (
            <motion.div
              key={t.id}
              initial={{
                opacity: 0,
                x: 100
              }}
              animate={{
                opacity: 1,
                x: 0
              }}
              exit={{
                opacity: 0,
                x: 100
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30
              }}
              className={`${v.bg} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[260px]`}>
              
              {v.icon}
              <span className="text-sm font-medium flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="opacity-70 hover:opacity-100"
                aria-label="Close">
                
                <XIcon size={16} />
              </button>
            </motion.div>);

        })}
      </AnimatePresence>
    </div>);

}