import toast from 'react-hot-toast';

// Dynamically import SweetAlert2 only on client side to avoid Next.js SSR errors
const getSwal = () => {
  if (typeof window !== 'undefined') {
    const Swal = require('sweetalert2');
    return Swal.mixin({
      background: '#0c0f0d',
      color: '#F4F6F0',
      customClass: {
        popup: 'rounded-[2rem] border border-amber-honey/25 shadow-2xl backdrop-blur-md font-outfit',
        title: 'font-serif uppercase tracking-widest text-amber-honey text-2xl mb-4',
        htmlContainer: 'font-outfit opacity-80 text-sm leading-relaxed text-[#F4F6F0]/80',
        confirmButton: 'bg-gradient-to-r from-amber-honey to-amber-gold hover:from-amber-gold hover:to-amber-500 text-[#1E2B22] font-black uppercase tracking-wider text-xs px-6 py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(229,169,59,0.2)] mx-2 focus:outline-none',
        cancelButton: 'bg-transparent border border-white/10 hover:border-white/20 text-[#F4F6F0]/60 hover:text-[#F4F6F0] font-black uppercase tracking-wider text-xs px-6 py-3 rounded-xl transition-all mx-2 focus:outline-none',
        actions: 'flex justify-center mt-6',
      },
      buttonsStyling: false,
    });
  }
  return null;
};

export const showConfirm = async (message: string, title: string = '¿Confirmar acción?'): Promise<boolean> => {
  const swal = getSwal();
  if (!swal) return false;
  const result = await swal.fire({
    title,
    text: message,
    icon: 'warning',
    iconColor: '#E5A93B',
    showCancelButton: true,
    confirmButtonText: 'Confirmar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  });
  return result.isConfirmed;
};

export const showAlert = async (
  message: string,
  title: string = 'Atención',
  type: 'info' | 'success' | 'error' | 'warning' = 'info'
): Promise<void> => {
  const swal = getSwal();
  if (!swal) return;
  
  let iconColor = '#E5A93B';
  if (type === 'error') iconColor = '#EF4444';
  else if (type === 'success') iconColor = '#10B981';
  else if (type === 'info') iconColor = '#3B82F6';

  await swal.fire({
    title,
    text: message,
    icon: type,
    iconColor,
    confirmButtonText: 'Aceptar',
  });
};

type ToastType = 'success' | 'error' | 'info';

export interface ToastFunction {
  (msg: string, type?: ToastType): void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const toastSuccess = (msg: string) => {
  toast.success(msg, {
    duration: 3500,
    style: {
      background: '#0c0f0d',
      color: '#F4F6F0',
      border: '1px solid rgba(229, 169, 59, 0.25)',
      borderRadius: '1rem',
      fontFamily: 'Outfit, sans-serif',
      fontSize: '0.875rem',
    },
    iconTheme: {
      primary: '#E5A93B',
      secondary: '#0c0f0d',
    },
  });
};

const toastError = (msg: string) => {
  toast.error(msg, {
    duration: 3500,
    style: {
      background: '#0c0f0d',
      color: '#F4F6F0',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      borderRadius: '1rem',
      fontFamily: 'Outfit, sans-serif',
      fontSize: '0.875rem',
    },
    iconTheme: {
      primary: '#EF4444',
      secondary: '#0c0f0d',
    },
  });
};

const toastInfo = (msg: string) => {
  toast(msg, {
    duration: 3500,
    style: {
      background: '#0c0f0d',
      color: '#F4F6F0',
      border: '1px solid rgba(59, 130, 246, 0.25)',
      borderRadius: '1rem',
      fontFamily: 'Outfit, sans-serif',
      fontSize: '0.875rem',
    },
    icon: 'ℹ️',
  });
};

const showToastCallable = ((msg: string, type: ToastType = 'info') => {
  if (type === 'success') toastSuccess(msg);
  else if (type === 'error') toastError(msg);
  else toastInfo(msg);
}) as ToastFunction;

showToastCallable.success = toastSuccess;
showToastCallable.error = toastError;
showToastCallable.info = toastInfo;

export const showToast = showToastCallable;
