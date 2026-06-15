import React from 'react';
import { ReturnNote, ReturnNoteItem } from '../types';
import { ClipboardCheck, Printer, ArrowLeft } from 'lucide-react'; // Wait, let's look at icons other than custom packages.

interface PrintPreviewProps {
  note: ReturnNote;
  items: ReturnNoteItem[];
  onBack: () => void;
}

export default function PrintPreview({ note, items, onBack }: PrintPreviewProps) {
  const printPage = () => {
    window.print();
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString();
      if (timestamp instanceof Date) return timestamp.toLocaleDateString();
      return new Date(timestamp).toLocaleDateString();
    } catch {
      return String(timestamp);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-8 font-sans text-slate-800 print:bg-white print:p-0">
      
      {/* Action panel - Hidden when printing */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Note Creator
        </button>
        <button
          onClick={printPage}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Trigger Print Dialog / PDF Export
        </button>
      </div>

      {/* Official Invoice Sheet */}
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 border border-slate-300 rounded-2xl shadow-md print:shadow-none print:border-none print:p-0">
        
        {/* Document Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xl uppercase tracking-wider mb-1">
              <span className="bg-emerald-100 p-1 rounded-md text-emerald-700 print:bg-transparent">ERN</span>
              Macmart Expiry Return Note
            </div>
            <p className="text-xs text-slate-500 font-mono">OFFICIAL EXPIRY CHECKPOINT DOCUMENT</p>
          </div>
          <div className="text-right md:text-right text-left">
            <div className="text-xs font-semibold uppercase text-slate-500 font-mono">Document reference:</div>
            <div className="font-mono text-base font-bold text-slate-900 tracking-wider bg-slate-50 px-2 py-1 rounded-sm mt-0.5 print:bg-transparent print:p-0">
              {note.noteNumber}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 mt-6 gap-4 text-xs font-sans pb-6 border-b">
          <div className="space-y-1.5">
            <h4 className="text-slate-400 font-semibold tracking-wider uppercase text-[10px]">Note Details</h4>
            <div className="text-slate-800 text-sm font-semibold">{note.title}</div>
            <div className="flex gap-2">
              <span className="text-slate-500">Status:</span>
              <span className="font-semibold text-emerald-700 uppercase tracking-widest text-[10px]">
                {note.status === 'completed' ? 'SUBMITTED & COMPLETED' : 'DRAFT INVENTORY'}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 md:text-right">
            <h4 className="text-slate-400 font-semibold tracking-wider uppercase text-[10px]">Registry Timestamps</h4>
            <div className="text-slate-700">Created date: <span className="font-medium font-mono text-slate-900">{formatDate(note.createdAt)}</span></div>
            <div className="text-slate-700">Modified date: <span className="font-medium font-mono text-slate-900">{formatDate(note.updatedAt)}</span></div>
          </div>
        </div>

        {/* Items Listing Table */}
        <div className="mt-8">
          <h4 className="text-xs font-bold text-slate-900 tracking-wider uppercase mb-3">
            REGISTERED EXPIRED INVENTORY ({items.length} Product{items.length === 1 ? '' : 's'})
          </h4>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-slate-450 uppercase text-[10px] tracking-wider bg-slate-50 print:bg-transparent font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Barcode / EAN</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-center">Expiry Date</th>
                <th className="py-2.5 px-3">Reason for Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={item.id} className="text-slate-800 hover:bg-slate-50/50">
                  <td className="py-3 px-3 text-center text-slate-400 font-mono">{index + 1}</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">{item.productName}</td>
                  <td className="py-3 px-3 font-mono text-slate-500">{item.barcode || 'N/A'}</td>
                  <td className="py-3 px-3 font-mono text-right font-bold text-slate-900">{item.quantity}</td>
                  <td className="py-3 px-3 text-center font-mono font-medium text-rose-700">{item.expiryDate}</td>
                  <td className="py-3 px-3 text-slate-600 italic">{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Verification Signatures */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-16 pt-10 border-t border-dashed">
          <div className="text-center space-y-12">
            <div className="border-b border-slate-300 w-3/4 mx-auto" />
            <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              1. Compiler Signature
            </p>
          </div>
          <div className="text-center space-y-12">
            <div className="border-b border-slate-300 w-3/4 mx-auto" />
            <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              2. Warehouse Manager<br/>
              <span className="text-[9px] text-slate-400 italic">(Verification Stamp)</span>
            </p>
          </div>
          <div className="text-center space-y-12">
            <div className="border-b border-slate-300 w-3/4 mx-auto" />
            <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              3. Logistics Agent<br/>
              <span className="text-[9px] text-slate-400 italic">(Return Collection)</span>
            </p>
          </div>
        </div>

        {/* Note Disclaimer */}
        <div className="mt-14 pt-6 border-t text-[10px] text-slate-400 leading-relaxed text-center italic">
          Disclaimer: This return note is generated automatically under compliant expiry procedures. All items catalogued above are certified as expired or unsuitable for retail, pending distributor disposal/reimbursement approval.
        </div>
      </div>
    </div>
  );
}
