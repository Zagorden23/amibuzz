import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Download, Sparkles, Loader2, Check } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { createPrintableStickerSheet } from '../../services/stickerStorage.js';
import { playSuccess } from '../../lib/audio.js';
import { fireConfetti } from '../../lib/confetti.js';

export const StickerSheetModal = ({ open, onClose, stickers, title = 'AmiBuzz Anime Collection' }) => {
  const [sheetDataUrl, setSheetDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!open || !stickers || stickers.length === 0) return;
    setLoading(true);
    setDownloaded(false);

    createPrintableStickerSheet(stickers, title)
      .then((url) => {
        setSheetDataUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to generate sticker sheet:', err);
        setLoading(false);
      });
  }, [open, stickers, title]);

  const handlePrint = () => {
    if (!sheetDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${title} - Printable Sticker Sheet</title>
          <style>
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
            img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
            @media print {
              body { margin: 0; }
              img { width: 100%; height: auto; }
            }
          </style>
        </head>
        <body>
          <img src="${sheetDataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    if (!sheetDataUrl) return;
    const link = document.createElement('a');
    link.href = sheetDataUrl;
    link.download = `amibuzz-printable-sticker-sheet.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloaded(true);
    playSuccess();
    fireConfetti();
    setTimeout(() => setDownloaded(false), 3000);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-[#140c1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Sparkles size={20} className="text-red-400" /> Printable Sticker Sheet
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">High-resolution A4 layout with cut-contour guides</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Loader2 size={36} className="text-red-400 animate-spin" />
                <p className="text-sm text-slate-400 font-bold">Rendering High-Res Printable Sheet...</p>
              </div>
            ) : sheetDataUrl ? (
              <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-2 border border-white/20">
                <img
                  src={sheetDataUrl}
                  alt="Printable Sticker Sheet Preview"
                  className="w-full h-auto rounded shadow object-contain"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Failed to render sheet.</p>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Ready for sticker paper, vinyl sheets, or labels
            </span>
            <div className="flex items-center gap-3 ml-auto">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading || !sheetDataUrl} className="gap-2">
                <Printer size={16} /> Print Sheet
              </Button>
              <Button size="sm" onClick={handleDownload} disabled={loading || !sheetDataUrl} className="gap-2">
                {downloaded ? <Check size={16} className="text-green-300" /> : <Download size={16} />}
                {downloaded ? 'Downloaded!' : 'Download Sheet'}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
