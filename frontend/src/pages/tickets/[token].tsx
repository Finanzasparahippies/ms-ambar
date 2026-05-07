import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';

export default function TicketPage() {
  const router = useRouter();
  const { token } = router.query;

  // In a real app, fetch ticket data using the token
  const ticketData = {
    event: "MS AMBAR - World Tour",
    date: "15 de Junio, 2026",
    venue: "Teatro Metropolitan",
    seat: "B-12",
    owner: "Fan #1"
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <Head>
        <title>Tu Boleto | MS AMBAR</title>
      </Head>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white text-black rounded-[40px] overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.1)]"
      >
        <div className="p-8 bg-black text-white text-center">
          <h1 className="text-2xl font-black tracking-tighter">MS AMBAR</h1>
          <p className="text-amber-500 text-xs uppercase tracking-widest mt-1">Boleto Digital</p>
        </div>

        <div className="p-10 flex flex-col items-center">
          <div className="bg-white p-4 rounded-3xl shadow-xl mb-8">
            <QRCodeSVG value={`https://msambar.dev/tickets/${token}`} size={200} />
          </div>

          <div className="w-full space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] uppercase text-neutral-400 font-bold">Evento</p>
                <p className="font-bold text-sm">{ticketData.event}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-neutral-400 font-bold">Fecha</p>
                <p className="font-bold text-sm">{ticketData.date}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-neutral-400 font-bold">Lugar</p>
                <p className="font-bold text-sm">{ticketData.venue}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-neutral-400 font-bold">Asiento</p>
                <p className="font-bold text-sm">{ticketData.seat}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-neutral-200">
              <p className="text-[10px] uppercase text-neutral-400 font-bold text-center mb-1">ID de Boleto</p>
              <p className="font-mono text-[10px] text-center text-neutral-500">{token || 'MS-AMBAR-XXXX-XXXX'}</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-500 p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-black">Presenta este código en la entrada</p>
        </div>
      </motion.div>
    </div>
  );
}
