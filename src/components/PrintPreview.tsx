import React from 'react';
import { ReturnNote, ReturnNoteItem } from '../types';
import { ArrowLeft, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

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

  const exportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      let currentPage = 1;

      // Draw standard brand top-bar and title header on each page
      const drawHeader = (pageNum: number) => {
        // Emerald brand bar at top
        doc.setFillColor(4, 120, 87);
        doc.rect(0, 0, pageWidth, 5, 'F');

        // Document tag
        doc.setFillColor(209, 250, 229); // emerald-100
        doc.rect(15, 12, 10, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(4, 120, 87);
        doc.text('ERN', 16.5, 16.2);

        // Corporate Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text('Macmart Expiry Return Note', 28, 16.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text('OFFICIAL EXPIRY CHECKPOINT DOCUMENT', 15, 24);

        // Right side Reference ID
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('DOCUMENT REFERENCE:', pageWidth - 15, 14, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(note.noteNumber, pageWidth - 15, 20.5, { align: 'right' });

        // Header boundary line
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.5);
        doc.line(15, 27, pageWidth - 15, 27);
      };

      // Draw standard corporate footer on each page
      const drawFooter = (pageNum: number) => {
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.5);
        doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          'Disclaimer: This return note is generated automatically under compliant expiry procedures. Registered items pending reimbursement.',
          pageWidth / 2,
          pageHeight - 11,
          { align: 'center' }
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Page ${pageNum}`, pageWidth - 15, pageHeight - 6, { align: 'right' });
      };

      // Draw metadata card info section
      const drawInfoCard = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('NOTE DETAILS', 15, 34);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(note.title || 'Untitled Expiry List', 15, 39);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('Status: ', 15, 44);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        const isCompleted = note.status === 'completed';
        doc.setTextColor(isCompleted ? 4 : 79, isCompleted ? 120 : 70, isCompleted ? 87 : 229); // emerald vs indigo
        doc.text(isCompleted ? 'SUBMITTED & COMPLETED' : 'DRAFT INVENTORY', 25, 44);

        // Right hand corporate timelines
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('REGISTRY TIMESTAMPS', pageWidth - 15, 34, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Created date: ${formatDate(note.createdAt)}`, pageWidth - 15, 39, { align: 'right' });
        doc.text(`Modified date: ${formatDate(note.updatedAt)}`, pageWidth - 15, 44, { align: 'right' });

        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.5);
        doc.line(15, 48, pageWidth - 15, 48);
      };

      // Draw initial pages
      drawHeader(currentPage);
      drawInfoCard();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`REGISTERED EXPIRED INVENTORY (${items.length} Product${items.length === 1 ? '' : 's'})`, 15, 54);

      // Table layout offsets
      let y = 58;
      const colX = [15, 23, 85, 120, 136, 161]; // Column offsets
      const colWidths = [8, 62, 35, 16, 25, 34]; // Column widths

      const drawTableHeader = (currentY: number) => {
        doc.setFillColor(241, 245, 249); // slate-100 column row
        doc.rect(15, currentY, pageWidth - 30, 6, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);

        doc.text('#', colX[0] + 4, currentY + 4.2, { align: 'center' });
        doc.text('PRODUCT NAME', colX[1], currentY + 4.2);
        doc.text('BARCODE / EAN', colX[2], currentY + 4.2);
        doc.text('QTY', colX[3] + colWidths[3], currentY + 4.2, { align: 'right' });
        doc.text('EXPIRY DATE', colX[4] + colWidths[4] / 2, currentY + 4.2, { align: 'center' });
        doc.text('REASON FOR RETURN', colX[5], currentY + 4.2);

        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.3);
        doc.line(15, currentY + 6, pageWidth - 15, currentY + 6);
      };

      drawTableHeader(y);
      y += 6; // start drawing rows

      items.forEach((item, index) => {
        // Multi-page layout flow safety checks
        const rowHeight = 7;
        const pageBottomLimit = pageHeight - 38; // leave space for footer and signature
        if (y > pageBottomLimit) {
          drawFooter(currentPage);
          doc.addPage();
          currentPage++;
          drawHeader(currentPage);
          
          y = 35; // Reset position on clean layout page
          drawTableHeader(y);
          y += 6;
        }

        // Alternate row highlights
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50 background stripes
          doc.rect(15, y, pageWidth - 30, rowHeight, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);

        // Column Index
        doc.text(String(index + 1), colX[0] + 4, y + 4.5, { align: 'center' });

        // Wrapped product title
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const displayName = item.productName || 'N/A';
        const wrappedTitle = doc.splitTextToSize(displayName, colWidths[1] - 2);
        doc.text(wrappedTitle[0] || 'N/A', colX[1], y + 4.5);

        // Barcode / EAN
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(item.barcode || 'N/A', colX[2], y + 4.5);

        // Quantity
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(String(item.quantity), colX[3] + colWidths[3], y + 4.5, { align: 'right' });

        // Expiry Date (Highlighted in deep Rose warning alert style)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(190, 24, 74); // rose-700
        doc.text(item.expiryDate || 'N/A', colX[4] + colWidths[4] / 2, y + 4.5, { align: 'center' });

        // Reason (wrapped)
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(71, 85, 105);
        const displayReason = item.reason || 'N/A';
        const wrappedReason = doc.splitTextToSize(displayReason, colWidths[5] - 2);
        doc.text(wrappedReason[0] || 'N/A', colX[5], y + 4.5);

        // Fine row separator line elements
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.setLineWidth(0.2);
        doc.line(15, y + rowHeight, pageWidth - 15, y + rowHeight);

        y += rowHeight;
      });

      // Signature Section space calculations
      const spaceForSignatures = 30;
      if (y > pageHeight - spaceForSignatures - 20) {
        drawFooter(currentPage);
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 35;
      }

      // Border and dashed divider lines
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([2, 1], 0);
      doc.line(15, y + 3, pageWidth - 15, y + 3);
      doc.setLineDashPattern([], 0);

      y += 11;

      // 3 signature column placements
      const signatureColW = (pageWidth - 30 - 10) / 3;
      const sigPositions = [15, 15 + signatureColW + 5, 15 + (signatureColW + 5) * 2];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      // Compiler signature Line Draw
      doc.setDrawColor(148, 163, 184); // slate-400
      doc.setLineWidth(0.3);
      doc.line(sigPositions[0], y, sigPositions[0] + signatureColW, y);
      doc.text('1. Compiler Signature', sigPositions[0] + signatureColW / 2, y + 4.2, { align: 'center' });

      // Manager Verification Line Draw
      doc.line(sigPositions[1], y, sigPositions[1] + signatureColW, y);
      doc.text('2. Warehouse Manager', sigPositions[1] + signatureColW / 2, y + 4.2, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.text('(Verification Stamp)', sigPositions[1] + signatureColW / 2, y + 7.2, { align: 'center' });

      // Logistics Agent Line Draw
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.line(sigPositions[2], y, sigPositions[2] + signatureColW, y);
      doc.text('3. Logistics Agent', sigPositions[2] + signatureColW / 2, y + 4.2, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.text('(Return Collection)', sigPositions[2] + signatureColW / 2, y + 7.2, { align: 'center' });

      // Conclude last page compilation
      drawFooter(currentPage);

      // Instantly open browser download dialogue
      const referenceName = note.noteNumber.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Macmart_Return_${referenceName}_Official_Note.pdf`);
    } catch (err: any) {
      alert("Error building client-side official high-res PDF document: " + err.message);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-8 font-sans text-slate-800 print:bg-white print:p-0">
      
      {/* Action panel - Hidden when printing */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Note Creator
        </button>
        
        <button
          onClick={exportPDF}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          title="Download pristine high-resolution inventory PDF document"
        >
          <Download className="w-4 h-4" />
          Save / Export as PDF
        </button>
      </div>

      {/* Official Invoice Sheet */}
      <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 border border-slate-300 rounded-2xl shadow-md print:shadow-none print:border-none print:p-0">
        
        {/* Document Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg uppercase tracking-wider mb-1">
              <span className="bg-emerald-100 p-1 rounded-md text-emerald-700 print:bg-transparent">ERN</span>
              Macmart Expiry Return Note
            </div>
            <p className="text-[10px] text-slate-500 font-mono">OFFICIAL EXPIRY CHECKPOINT DOCUMENT</p>
          </div>
          <div className="text-right md:text-right text-left">
            <div className="text-[10px] font-semibold uppercase text-slate-500 font-mono">Document reference:</div>
            <div className="font-mono text-sm font-bold text-slate-900 tracking-wider bg-slate-50 px-2 py-1 rounded-sm mt-0.5 print:bg-transparent print:p-0">
              {note.noteNumber}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 mt-4 gap-4 text-xs font-sans pb-4 border-b print:mt-3 print:pb-3">
          <div className="space-y-1">
            <h4 className="text-slate-400 font-semibold tracking-wider uppercase text-[9px]">Note Details</h4>
            <div className="text-slate-800 text-xs font-semibold">{note.title}</div>
            <div className="flex gap-2 text-[11px]">
              <span className="text-slate-500">Status:</span>
              <span className="font-bold text-emerald-700 uppercase tracking-widest text-[9px]">
                {note.status === 'completed' ? 'SUBMITTED & COMPLETED' : 'DRAFT INVENTORY'}
              </span>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <h4 className="text-slate-400 font-semibold tracking-wider uppercase text-[9px]">Registry Timestamps</h4>
            <div className="text-slate-700 text-[11px]">Created date: <span className="font-medium font-mono text-slate-900">{formatDate(note.createdAt)}</span></div>
            <div className="text-slate-700 text-[11px]">Modified date: <span className="font-medium font-mono text-slate-900">{formatDate(note.updatedAt)}</span></div>
          </div>
        </div>

        {/* Items Listing Table */}
        <div className="mt-6">
          <h4 className="text-[11px] font-bold text-slate-900 tracking-wider uppercase mb-2">
            REGISTERED EXPIRED INVENTORY ({items.length} Product{items.length === 1 ? '' : 's'})
          </h4>
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-450 uppercase text-[9px] tracking-wider bg-slate-50 print:bg-transparent font-semibold">
                <th className="py-1.5 px-2 w-8 text-center bg-slate-100/50 print:bg-transparent">#</th>
                <th className="py-1.5 px-2 bg-slate-100/50 print:bg-transparent">Product Name</th>
                <th className="py-1.5 px-2 bg-slate-100/50 print:bg-transparent">Barcode / EAN</th>
                <th className="py-1.5 px-2 text-right bg-slate-100/50 print:bg-transparent">Qty</th>
                <th className="py-1.5 px-2 text-center bg-slate-100/50 print:bg-transparent">Expiry Date</th>
                <th className="py-1.5 px-2 bg-slate-100/50 print:bg-transparent font-semibold">Reason for Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={item.id} className="text-slate-850 hover:bg-slate-50/50">
                  <td className="py-1 px-2 text-center text-slate-400 font-mono text-[10px]">{index + 1}</td>
                  <td className="py-1 px-2 font-medium text-slate-900 max-w-[200px] break-words">{item.productName}</td>
                  <td className="py-1 px-2 font-mono text-slate-500 text-[10px]">{item.barcode || 'N/A'}</td>
                  <td className="py-1 px-2 font-mono text-right font-bold text-slate-900">{item.quantity}</td>
                  <td className="py-1 px-2 text-center font-mono font-medium text-rose-700 text-[10px]">{item.expiryDate}</td>
                  <td className="py-1 px-2 text-slate-650 italic text-[11px] max-w-[220px] break-words">{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Verification Signatures */}
        <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-dashed print:gap-4 print:mt-10 print:pt-6">
          <div className="text-center space-y-10 print:space-y-8">
            <div className="border-b border-slate-300 w-full mx-auto" />
            <p className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase leading-snug">
              1. Compiler Signature
            </p>
          </div>
          <div className="text-center space-y-10 print:space-y-8">
            <div className="border-b border-slate-300 w-full mx-auto" />
            <p className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase leading-snug">
              2. Warehouse Manager<br/>
              <span className="text-[8px] text-slate-400 italic font-normal">(Verification Stamp)</span>
            </p>
          </div>
          <div className="text-center space-y-10 print:space-y-8">
            <div className="border-b border-slate-300 w-full mx-auto" />
            <p className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase leading-snug">
              3. Logistics Agent<br/>
              <span className="text-[8px] text-slate-400 italic font-normal">(Return Collection)</span>
            </p>
          </div>
        </div>

        {/* Note Disclaimer */}
        <div className="mt-10 pt-4 border-t text-[9px] text-slate-400 leading-relaxed text-center italic">
          Disclaimer: This return note is generated automatically under compliant expiry procedures. All items catalogued above are certified as expired or unsuitable for retail, pending distributor disposal/reimbursement approval.
        </div>
      </div>
    </div>
  );
}
