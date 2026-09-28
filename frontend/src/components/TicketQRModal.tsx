import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import TicketPass, { TicketPassProps } from './TicketPass';

export interface TicketQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: TicketPassProps['ticket'];
  event: TicketPassProps['event'];
  seat?: TicketPassProps['seat'];
}

export const TicketQRModal: React.FC<TicketQRModalProps> = ({
  isOpen,
  onClose,
  ticket,
  event,
  seat
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-lg my-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute -top-12 right-0 sm:-right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90 z-10"
            title="Cerrar Pase"
          >
            <X size={18} />
          </button>

          <TicketPass
            ticket={ticket}
            event={event}
            seat={seat}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TicketQRModal;
