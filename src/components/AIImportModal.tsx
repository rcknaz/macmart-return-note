import React, { useState } from 'react';
import { Sparkles, X, Loader, CornerDownLeft, AlertCircle } from 'lucide-react';

interface AIImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[]) => void;
}

export default function AIImportModal({ isOpen, onClose, onImport }: AIImportModalProps) {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  if (!isOpen) return null;

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/gemini/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        throw new Error('Failed to reach Gemini API. Please check server logs.');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      const items = data.items || [];
      if (items.length === 0) {
        setError("AI couldn't extract any structured return items. Try writing a clearer list including name, date or quantity.");
      } else {
        onImport(items);
        setInputText('');
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error parsing product return lists.');
    } finally {
      setIsLoading(false);
    }
  };

  const setPreset = (text: string) => {
    setInputText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-650/40 p-1.5 rounded-lg border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-400 fill-indigo-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-lg font-sans">AI Smart Bulk Expiry Parser</h3>
              <p className="text-xs text-slate-300">Type or paste natural language to extract items automatically</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleAISubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-705 text-left">
              Describe your expired products
            </label>
            <span className="text-xs text-slate-500 block leading-relaxed text-left">
              We'll use Gemini to instantly extract the product name, barcode/EAN, quantity, expiry date, and standard return category.
            </span>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={6}
              disabled={isLoading}
              className="mt-2 block w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 resize-y"
              placeholder="Example: We found 12 boxes of Choco Milk EAN 76130358 exp dec 30th 2026 with damaged box, also 4 units of Sunshine Margarine bar code 4800110 expiring next week 06/21/2026 because they are past date."
            />
          </div>

          {/* Quick presets */}
          <div className="text-left">
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Presets to try:</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setPreset("Return 20 units of Heinz Tomato Ketchup (barcode 40012354) that expired on May 10, 2026 because they are past state.")}
                className="text-xs bg-slate-100 text-slate-750 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 font-medium px-3 py-1.5 rounded-lg transition-all text-left cursor-pointer"
              >
                Heinz Ketchup (Single Product)
              </button>
              <button
                type="button"
                onClick={() => setPreset("Found multiple: 15 packs of Ritz Crackers EAN 04400000 expiring on 08/15/2026 close to expiry, and 6 liters of Organic Milk (barcode 02113000) expired on 06/01/2026 spoiled")}
                className="text-xs bg-slate-100 text-slate-750 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 font-medium px-3 py-1.5 rounded-lg transition-all text-left cursor-pointer"
              >
                Multiple Expired Products Batch
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating Items...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white text-white" />
                  Extract & Append
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
