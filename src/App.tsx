import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  Plus, 
  Sparkles, 
  Camera, 
  FileText, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  LogOut, 
  AlertCircle, 
  Lock, 
  Layers, 
  Search, 
  Printer, 
  Bookmark, 
  ArrowRight, 
  UserCheck, 
  Calendar, 
  Hash, 
  ChevronRight,
  HelpCircle,
  TrendingDown,
  Activity,
  User as UserIcon,
  BadgeAlert,
  Edit2,
  ClipboardCheck
} from 'lucide-react';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { ReturnNote, ReturnNoteItem, COMMON_REASONS } from './types';
import AIImportModal from './components/AIImportModal';
import BarcodeScanner from './components/BarcodeScanner';
import PrintPreview from './components/PrintPreview';

// Helper to generate compliant alphanumeric document IDs
function generateSecureId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate serial ERN note string
function generateNoteNumber() {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date();
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const date = pad(d.getDate());
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ERN-${year}${month}${date}-${rand}`;
}

export default function App() {
  // App context states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [useMockAuth, setUseMockAuth] = useState(true);
  const [mockUser, setMockUser] = useState<{uid: string, email: string, displayName: string} | null>({
    uid: 'DEMO_SANDBOX_USER_99',
    email: 'macmartsupport@gmail.com',
    displayName: 'MacMart Support Officer'
  });

  // Notes and active sub-view states
  const [notes, setNotes] = useState<ReturnNote[]>([]);
  const [activeNote, setActiveNote] = useState<ReturnNote | null>(null);
  const [noteItems, setNoteItems] = useState<ReturnNoteItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create / Edit Note states
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [confirmCompleteNoteOpen, setConfirmCompleteNoteOpen] = useState(false);

  // App UI states
  const [showAIModal, setShowAIModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // AI assist states
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiDetailsSuggestions, setAiDetailsSuggestions] = useState<string[]>([]);
  const [barcodeLookupStatus, setBarcodeLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [googleFoundName, setGoogleFoundName] = useState('');
  
  // Client-side deduplication guard
  const lastSearchRef = React.useRef({ name: '', bar: '' });

  // Item Form states
  const [productName, setProductName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState('');
  const [returnReason, setReturnReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // Monitor Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Enforce verified emails (rules require it)
        setCurrentUser(user);
        setUseMockAuth(false);
      } else {
        setCurrentUser(null);
        // Automatically default to demo mode so there is No Sign-In/Sign-Up wall
        setUseMockAuth(true);
        setMockUser({
          uid: 'DEMO_SANDBOX_USER_99',
          email: 'macmartsupport@gmail.com',
          displayName: 'MacMart Support Officer'
        });
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Enter Demo Mode Sandbox (Bypasses iframe blocked popups for quick evaluation)
  const triggerDemoAccount = () => {
    setAuthChecking(true);
    // Mimic verified system user state
    const demoUser = {
      uid: 'DEMO_SANDBOX_USER_99',
      email: 'macmartsupport@gmail.com',
      displayName: 'MacMart Support Officer'
    };
    setMockUser(demoUser);
    setUseMockAuth(true);
    setAuthChecking(false);
  };

  const getEffectiveUID = () => {
    if (useMockAuth && mockUser) return mockUser.uid;
    return currentUser?.uid || '';
  };

  const getEffectiveEmail = () => {
    if (useMockAuth && mockUser) return mockUser.email;
    return currentUser?.email || 'unregistered@expirednote.com';
  };

  const handleSignIn = async () => {
    try {
      setGeneralError('');
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn("Popup blocked, fallback to demo mode:", err);
      setGeneralError("Auth popup was blocked or blocked inside the sandbox. We've unlocked Sandbox Demo mode below!");
    }
  };

  const handleSignOut = async () => {
    try {
      if (useMockAuth) {
        // Keep the demo user logged in or reset state to ensure "No Sign In" rule
        setActiveNote(null);
        setNoteItems([]);
      } else {
        await signOut(auth);
      }
      // Re-initialize demo user to stay signed in
      setMockUser({
        uid: 'DEMO_SANDBOX_USER_99',
        email: 'macmartsupport@gmail.com',
        displayName: 'MacMart Support Officer'
      });
      setUseMockAuth(true);
    } catch (err: any) {
      setGeneralError(err?.message || 'Error resetting terminal.');
    }
  };

  // Listen to Return Notes collections
  useEffect(() => {
    const uid = getEffectiveUID();
    if (!uid) return;

    const path = 'returnNotes';
    try {
      const q = query(
        collection(db, path),
        where('creatorId', '==', uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedNotes: ReturnNote[] = [];
        snapshot.forEach((doc) => {
          loadedNotes.push({ id: doc.id, ...doc.data() } as ReturnNote);
        });
        setNotes(loadedNotes);
        
        // Auto-select first note if none selected
        if (loadedNotes.length > 0 && !activeNote) {
          // Keep active selected if it still exists
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error(err);
    }
  }, [currentUser, useMockAuth, mockUser]);

  // Listen to items of the selected active Note
  useEffect(() => {
    if (!activeNote) {
      setNoteItems([]);
      return;
    }

    const path = `returnNotes/${activeNote.id}/items`;
    try {
      const q = query(
        collection(db, path),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedItems: ReturnNoteItem[] = [];
        snapshot.forEach((doc) => {
          loadedItems.push({ id: doc.id, ...doc.data() } as ReturnNoteItem);
        });
        setNoteItems(loadedItems);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error(err);
    }
  }, [activeNote]);

  // Helper to test if a product of some note has expired
  const isDateExpired = (dateString: string) => {
    if (!dateString) return false;
    const now = new Date();
    now.setHours(0,0,0,0);
    const exp = new Date(dateString);
    return exp < now;
  };

  // Helper to count near-expiry (within next 30 days)
  const isDateNearExpiry = (dateString: string) => {
    if (!dateString) return false;
    const now = new Date();
    now.setHours(0,0,0,0);
    const exp = new Date(dateString);
    if (exp < now) return false;
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    return exp <= thirtyDaysLater;
  };

  // Creating a new return note draft
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = getEffectiveUID();
    if (!uid || !newNoteTitle.trim()) return;

    setGeneralError('');
    setIsCreatingNote(true);

    const noteId = generateSecureId();
    const noteNum = generateNoteNumber();

    const path = 'returnNotes';
    try {
      const noteDocRef = doc(db, path, noteId);
      const newNotePayload = {
        id: noteId,
        noteNumber: noteNum,
        title: newNoteTitle.trim(),
        status: 'draft',
        creatorId: uid,
        creatorEmail: getEffectiveEmail(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(noteDocRef, newNotePayload);
      setNewNoteTitle('');
      
      // Select the newly created note
      // A local mock version first to display it immediately
      const mockNote: ReturnNote = {
        ...newNotePayload,
        // use local dates immediately so loading spinner isn't stuck
        createdAt: new Date(),
        updatedAt: new Date()
      } as any;
      
      setActiveNote(mockNote);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${noteId}`);
      setGeneralError("Failed to save Return Note draft. Firestore permission denied.");
    } finally {
      setIsCreatingNote(false);
    }
  };

  // Appending items to active draft
  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeNote || activeNote.status === 'completed') return;
    if (!productName.trim() || quantity <= 0 || !expiryDate) {
      setGeneralError('Please specify product name, positive quantity, and a valid expiry date.');
      return;
    }

    setGeneralError('');
    const itemId = generateSecureId();
    const path = `returnNotes/${activeNote.id}/items`;

    try {
      const finalReason = returnReason === 'Other (Please specify)' ? customReason : returnReason;
      const itemDocRef = doc(db, path, itemId);
      
      const itemPayload = {
        id: itemId,
        productName: productName.trim(),
        barcode: barcode.trim(),
        quantity: Number(quantity),
        expiryDate,
        reason: finalReason || 'Expired',
        createdAt: serverTimestamp()
      };

      await setDoc(itemDocRef, itemPayload);
      
      // Update parent updated timestamp
      const parentRef = doc(db, 'returnNotes', activeNote.id);
      await updateDoc(parentRef, {
        updatedAt: serverTimestamp()
      });

      // Clear input fields
      setProductName('');
      setBarcode('');
      setQuantity(1);
      setExpiryDate('');
      setCustomReason('');
      setAiDetailsSuggestions([]);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${itemId}`);
      setGeneralError("Couldn't add product. Verity parent status isn't Completed.");
    }
  };

  // Safe completion confirm triggers
  const triggerCompleteConfirmation = () => {
    if (!activeNote || activeNote.status === 'completed') return;
    if (noteItems.length === 0) {
      setGeneralError('Cannot lock/complete an empty return note. Register at least 1 product.');
      return;
    }
    setConfirmCompleteNoteOpen(true);
  };

  // Triggering the complete note submission (terminal state locking)
  const handleCompleteNote = async () => {
    if (!activeNote || activeNote.status === 'completed') return;
    setGeneralError('');
    setConfirmCompleteNoteOpen(false);
    const path = `returnNotes/${activeNote.id}`;

    try {
      const noteDocRef = doc(db, 'returnNotes', activeNote.id);
      await updateDoc(noteDocRef, {
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      // Update active note status locally in memory
      setActiveNote(prev => prev ? { ...prev, status: 'completed' } : null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      setGeneralError("Could not lock return note format in Database.");
    }
  };

  // Delete dynamic sub-item
  const handleDeleteItem = async (itemId: string) => {
    if (!activeNote || activeNote.status === 'completed') return;
    
    setGeneralError('');
    const path = `returnNotes/${activeNote.id}/items/${itemId}`;

    try {
      const itemDocRef = doc(db, `returnNotes/${activeNote.id}/items`, itemId);
      await deleteDoc(itemDocRef);

      // Update parent updatedAt
      const parentRef = doc(db, 'returnNotes', activeNote.id);
      await updateDoc(parentRef, {
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Safe delete triggers
  const triggerDeleteConfirmation = (noteId: string) => {
    const noteToDelete = notes.find(n => n.id === noteId);
    if (!noteToDelete) return;
    if (noteToDelete.status === 'completed') {
      setGeneralError("Completed return notes cannot be deleted.");
      return;
    }
    setConfirmDeleteNoteId(noteId);
  };

  // Delete an entire Note
  const handleDeleteNote = async (noteId: string) => {
    const noteToDelete = notes.find(n => n.id === noteId);
    if (!noteToDelete || noteToDelete.status === 'completed') {
      setGeneralError("Completed return notes cannot be deleted.");
      return;
    }

    setConfirmDeleteNoteId(null);
    setGeneralError('');
    const path = `returnNotes/${noteId}`;

    try {
      // Clean up the main document
      const docRef = doc(db, 'returnNotes', noteId);
      await deleteDoc(docRef);

      if (activeNote?.id === noteId) {
        setActiveNote(null);
        setNoteItems([]);
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Receive bulk extracted items from Gemini AI Parser
  const handleAIBulkImport = async (parsedItems: any[]) => {
    if (!activeNote) return;
    setGeneralError('');

    try {
      // Loop over parsed items and write them sequentially or in batches
      for (const item of parsedItems) {
        const itemId = generateSecureId();
        const itemDocRef = doc(db, `returnNotes/${activeNote.id}/items`, itemId);
        
        await setDoc(itemDocRef, {
          id: itemId,
          productName: item.productName || 'Unspecified Product',
          barcode: item.barcode || '',
          quantity: item.quantity ? Math.max(1, Number(item.quantity)) : 1,
          expiryDate: item.expiryDate || new Date().toISOString().slice(0, 10),
          reason: item.reason || 'Expired',
          createdAt: serverTimestamp()
        });
      }

      // Update parent updated time
      const parentRef = doc(db, 'returnNotes', activeNote.id);
      await updateDoc(parentRef, {
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      setGeneralError("Error importing AI parsed items. Verify security rules permissions.");
    }
  };

  // Scanner capture handler
  const handleBarcodeScanned = (scannedCode: string, suggestedName: string) => {
    setBarcode(scannedCode);
    setProductName(suggestedName || 'Looking up barcode on Google...');
    setShowScanner(false);
    
    setBarcodeLookupStatus('searching');
    setGoogleFoundName('');
    
    triggerAiDetailsAssist(suggestedName, scannedCode);
  };

  // Call server middleware logic to suggest spelling, similar products, or reasons
  const triggerAiDetailsAssist = async (name: string, bar: string) => {
    if (!name && !bar) return;

    // Clean loading/placeholder words
    const cleanName = (name === 'Looking up barcode on Google...' || name.includes('Searching Google for EAN')) ? '' : name.trim();
    const cleanBar = bar ? bar.trim().replace(/\s/g, '') : '';

    if (!cleanName && !cleanBar) return;

    // Check last-searched ref guard to completely omit consecutive duplicate hits
    if (lastSearchRef.current.name === cleanName && lastSearchRef.current.bar === cleanBar) {
      return;
    }
    lastSearchRef.current = { name: cleanName, bar: cleanBar };

    setAiSuggesting(true);
    setAiDetailsSuggestions([]);
    
    const isSearchingBarcode = !!cleanBar && (!cleanName || cleanName === 'Looking up barcode on Google...');
    if (isSearchingBarcode) {
      setBarcodeLookupStatus('searching');
      setGoogleFoundName('');
    }

    try {
      const response = await fetch('/api/gemini/suggest-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: cleanName, barcode: cleanBar })
      });

      if (response.ok) {
        const data = await response.json();

        // Show gentle indicator if rate-limited but return standard/cached responses gracefully
        if (data.rateLimited) {
          setGeneralError("AI Quota Limit Reached: Running with local/cached standard presets. You can continue adding items customly as normal!");
        }

        if (data.suggestedName && data.suggestedName !== 'Looking up barcode on Google...') {
          setProductName(data.suggestedName);
          if (isSearchingBarcode || cleanBar) {
            setGoogleFoundName(data.suggestedName);
            setBarcodeLookupStatus('found');
          }
        } else if (isSearchingBarcode) {
          setBarcodeLookupStatus('not_found');
          setProductName('');
        }

        if (data.suggestedBarcode && !barcode) {
          setBarcode(data.suggestedBarcode);
        }
        if (data.reasons) {
          setAiDetailsSuggestions(data.reasons);
        }
      } else if (isSearchingBarcode) {
        setBarcodeLookupStatus('not_found');
        setProductName('');
      }
    } catch (error) {
      console.warn("AI suggestions could not be loaded:", error);
      if (isSearchingBarcode) {
        setBarcodeLookupStatus('not_found');
        setProductName('');
      }
    } finally {
      setAiSuggesting(false);
    }
  };

  // Filter notes by search query
  const filteredNotes = notes.filter(n => {
    const query = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(query) || n.noteNumber.toLowerCase().includes(query);
  });

  // Calculate high-level stats for active note
  const expiredCount = noteItems.filter(i => isDateExpired(i.expiryDate)).length;
  const nearExpiryCount = noteItems.filter(i => isDateNearExpiry(i.expiryDate)).length;
  const totalVolume = noteItems.reduce((acc, current) => acc + current.quantity, 0);

  if (isPrinting && activeNote) {
    return (
      <PrintPreview 
        note={activeNote} 
        items={noteItems} 
        onBack={() => setIsPrinting(false)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-905 font-sans antialiased flex flex-col">
      
      {/* GLOBAL HEADER BAR - Light theme from Sleek Interface */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-xs">
            <ClipboardCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <span className="font-bold text-[10px] tracking-widest font-sans text-indigo-600 block uppercase leading-none">Macmart Logistics</span>
            <h1 className="text-base font-black text-slate-850 font-sans tracking-tight leading-none uppercase mt-0.5">
              Expiry<span className="text-indigo-600">Return Note</span>
            </h1>
          </div>
        </div>

        {/* Header content & Auth Module */}
        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Location</p>
            <p className="text-xs font-bold text-slate-700 mt-0.5">Warehouse Alpha-7</p>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-xs flex items-center justify-center text-slate-600 font-bold shrink-0 text-sm">
                JD
              </div>
              <div className="hidden sm:block text-left font-sans">
                <span className="text-xs font-semibold block text-slate-705 text-slate-700 truncate max-w-[140px]">
                  MacMart Support Officer
                </span>
                <span className="text-[9px] text-slate-400 block font-semibold uppercase tracking-wider">
                  Active Staff Session
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ERROR BANNER */}
      {generalError && (
        <div className="bg-rose-50 border-b border-rose-100 p-3 flex items-start gap-2 text-rose-900 text-xs px-4 md:px-8">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Notification Alert</span>
            <span className="text-slate-600 leading-relaxed">{generalError}</span>
          </div>
          <button 
            onClick={() => setGeneralError('')} 
            className="text-rose-700 hover:text-rose-950 font-bold text-sm px-1.5 rounded-md hover:bg-rose-100"
          >
            ×
          </button>
        </div>
      )}

      {/* LOGIN PROMPT SCREEN */}
      {!(currentUser || useMockAuth) && !authChecking ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 md:py-24">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 shadow-lg text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-sm">
              <ClipboardCheck className="w-8 h-8 stroke-[2.2]" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-sans tracking-tight text-slate-900">Macmart Expiry Return Note</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Log in securely to catalog damaged, expired, or non-compliant inventory return notes with barcodes & and real-time ledger persistence.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSignIn}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer text-sm"
              >
                <span className="font-medium">Sign In using Google Account</span>
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider font-mono">Sandbox Demo Access</span>
                </div>
              </div>

              <button
                onClick={triggerDemoAccount}
                className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-805 border border-indigo-200 font-semibold py-3 px-4 rounded-xl transition-all text-sm cursor-pointer"
              >
                No login required — Explore Demo Sandbox
              </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
              Note: Iframe sandbox restrictions may prevent redirects. If Google login does not trigger a popup, use the Demo Sandbox option to test fully.
            </p>
          </div>
        </div>
      ) : (

        /* MAIN APP REGISTRY CONTAINER */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* LEFT SIDEBAR: Created Return Notes Ledger */}
          <aside className="lg:col-span-4 bg-white border-r border-slate-200 flex flex-col min-h-0">
            {/* Ledger Header */}
            <div className="p-4 border-b border-slate-100 space-y-3.5 bg-slate-50/55">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 tracking-wider uppercase font-sans">Return Notes Ledger</h2>
                  <p className="text-xs text-slate-400 font-medium">Batch files & registered compilations</p>
                </div>
                
                <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  {notes.length} Active
                </span>
              </div>

              {/* Fast note search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 text-xs rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Query by note ID or title..."
                />
              </div>

              {/* Generate new note draft widget */}
              <form onSubmit={handleCreateNote} className="flex gap-2 bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
                <input
                  type="text"
                  required
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="New note title (e.g. 'June Store Expiries')"
                  className="flex-1 py-1 px-2 text-xs bg-white border border-slate-200 text-slate-800 rounded-lg placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="submit"
                  disabled={isCreatingNote || !newNoteTitle.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-lg shrink-0 transition-all cursor-pointer disabled:opacity-50"
                  title="Initialize Draft"
                >
                  <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                </button>
              </form>
            </div>

            {/* Notes collection renderer list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredNotes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2 mt-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-500">No Return Notes Found</p>
                  <p className="text-[11px] leading-relaxed max-w-xs mx-auto">
                    Initialize a new Draft note with a title above or clear active search filter.
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isActive = activeNote?.id === note.id;
                  const isLocked = note.status === 'completed';
                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        setActiveNote(note);
                        setGeneralError('');
                      }}
                      className={`p-4 text-left cursor-pointer transition-all border-l-[3.5px] relative group ${
                        isActive 
                          ? 'border-indigo-605 border-indigo-600 bg-indigo-50/25' 
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] text-slate-400 block tracking-wider">
                          {note.noteNumber}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {isLocked ? (
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 font-sans tracking-wide">
                              <CheckCircle2 className="w-2.5 h-2.5 text-slate-500 fill-slate-100 shrink-0" />
                              LOCKED
                            </span>
                          ) : (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200/40 font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 font-sans tracking-wide">
                              <Clock className="w-2.5 h-2.5 text-amber-505 shrink-0 animate-pulse" />
                              DRAFT
                            </span>
                          )}

                          {!isLocked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerDeleteConfirmation(note.id);
                              }}
                              className="opacity-75 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all shrink-0 cursor-pointer"
                              title="Delete Note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className={`text-xs font-bold leading-relaxed mt-1 ${isActive ? 'text-indigo-950 text-indigo-900' : 'text-slate-800'}`}>
                        {note.title}
                      </h3>

                      <div className="flex justify-between items-center mt-2.5 text-[10px] text-slate-400">
                        <span className="font-mono">{note.creatorEmail}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* RIGHT VIEWPORT: Note Details & Active Item Registry */}
          <main className="lg:col-span-8 flex flex-col min-h-0 overflow-y-auto">
            {activeNote ? (
              <div className="flex-1 flex flex-col">
                
                {/* Note Details Meta Banner */}
                <div className="bg-white border-b border-slate-200 p-5 md:p-6 space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-454 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-bold tracking-wider">
                          {activeNote.noteNumber}
                        </span>
                        
                        {activeNote.status === 'completed' ? (
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-mono font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200">
                            <CheckCircle2 className="w-3 h-3 text-slate-500 fill-slate-100" />
                            Completed Note (Read Only)
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-mono font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200/30">
                            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                            Draft Workspace
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 leading-tight">{activeNote.title}</h2>
                    </div>

                    {/* Operational trigger buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {activeNote.status !== 'completed' ? (
                        <>
                          <button
                            onClick={() => setShowAIModal(true)}
                            className="bg-slate-900 text-[11px] text-slate-50 font-semibold px-3 py-1.5 rounded-xl border border-slate-800 shadow-xs hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5 fill-indigo-400 text-indigo-400 transform rotate-12" />
                            AI Voice/Text Batch Import
                          </button>
                          
                          <button
                            onClick={triggerCompleteConfirmation}
                            className="bg-indigo-600 text-[11px] text-white font-bold px-3 py-1.5 rounded-xl shadow-sm hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                          >
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            Lock & Submit Note
                          </button>
                        </>
                      ) : (
                        <div className="p-1 px-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 text-[10px] font-medium leading-normal max-w-xs">
                          Securely locked from edits under local return guidelines.
                        </div>
                      )}

                      <button
                        onClick={() => setIsPrinting(true)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] border border-slate-250 font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print / Export E-Invoice
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-left">
                      <div className="text-[10px] text-slate-450 font-bold uppercase tracking-wider font-mono">Product Lines</div>
                      <div className="text-lg font-sans font-black text-slate-800 mt-1">{noteItems.length}</div>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-left">
                      <div className="text-[10px] text-slate-450 font-bold uppercase tracking-wider font-mono">Total Volume</div>
                      <div className="text-lg font-sans font-black text-slate-800 mt-1">{totalVolume} Items</div>
                    </div>

                    <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-left">
                      <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider font-mono">Expired Items</div>
                      <div className="text-lg font-sans font-black text-rose-700 mt-1">{expiredCount}</div>
                    </div>

                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-left">
                      <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider font-mono">Near Expiry <span className="text-[9px] text-slate-400 capitalize">(30d)</span></div>
                      <div className="text-lg font-sans font-black text-amber-700 mt-1">{nearExpiryCount}</div>
                    </div>
                  </div>
                </div>

                {/* Return Form (Only visible in draft mode) */}
                {activeNote.status !== 'completed' && (
                  <div className="bg-[#FAFBFD] p-5 border-b border-slate-200">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
                      Add Expired Product Item
                    </h3>

                    <form onSubmit={handleAddItem} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                        
                        {/* 1. Barcode field with toggle Scanner */}
                        <div className="md:col-span-3 space-y-1 text-left">
                          <label className="text-[11px] font-semibold text-slate-650 flex items-center justify-between">
                            <span>Barcode / EAN</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const text = await navigator.clipboard.readText();
                                    const trimmed = text?.trim();
                                    if (trimmed) {
                                      setBarcode(trimmed);
                                      setBarcodeLookupStatus('searching');
                                      setGoogleFoundName('');
                                      setProductName('Looking up barcode on Google...');
                                      triggerAiDetailsAssist('', trimmed);
                                    } else {
                                      alert("Clipboard is empty. Please copy a barcode first!");
                                    }
                                  } catch (err) {
                                    const val = prompt("Paste / Enter barcode (UPC / EAN) for auto-grounding scan:");
                                    if (val?.trim()) {
                                      const cleanVal = val.trim();
                                      setBarcode(cleanVal);
                                      setBarcodeLookupStatus('searching');
                                      setGoogleFoundName('');
                                      setProductName('Looking up barcode on Google...');
                                      triggerAiDetailsAssist('', cleanVal);
                                    }
                                  }
                                }}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                                title="Auto-paste & scan from clipboard"
                              >
                                <ClipboardCheck className="w-3 h-3 shrink-0" />
                                Paste & Scan
                              </button>
                              <span className="text-slate-350 select-none">|</span>
                              <button
                                type="button"
                                onClick={() => setShowScanner(!showScanner)}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                              >
                                <Camera className="w-3 h-3 shrink-0" />
                                {showScanner ? 'Hide Scanner' : 'Toggle Cam'}
                              </button>
                            </div>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={barcode}
                              onPaste={(e) => {
                                const pastedText = e.clipboardData.getData('Text')?.trim();
                                if (pastedText) {
                                  setBarcode(pastedText);
                                  setBarcodeLookupStatus('searching');
                                  setGoogleFoundName('');
                                  setProductName('Looking up barcode on Google...');
                                  triggerAiDetailsAssist('', pastedText);
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBarcode(val);
                                if (barcodeLookupStatus !== 'idle') setBarcodeLookupStatus('idle');

                                // Auto-trigger is disabled during manual keystroke entry to prevent 429 quota exhaustion. 
                                // Users can trigger auto-lookup via Enter key, Paste, Blur, or by clicking the Search Icon.
                              }}
                              onBlur={() => {
                                if (barcode.trim()) {
                                  triggerAiDetailsAssist(productName, barcode);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  triggerAiDetailsAssist(productName, barcode);
                                }
                              }}
                              placeholder="Type or scan EAN..."
                              className="w-full pr-8 px-3 py-1.5 bg-white border border-slate-200 text-xs rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono tracking-wide"
                            />
                            {barcode.trim() && (
                              <button
                                type="button"
                                onClick={() => triggerAiDetailsAssist(productName, barcode)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors p-0.5 cursor-pointer"
                                title="Search Barcode on Google"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {barcodeLookupStatus === 'searching' && (
                            <div className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 mt-1 animate-pulse">
                              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping"></span>
                              Searching Google for EAN...
                            </div>
                          )}
                          {barcodeLookupStatus === 'found' && googleFoundName && (
                            <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                              <span className="text-emerald-500">✓</span> Grounded on Google Search!
                            </div>
                          )}
                          {barcodeLookupStatus === 'not_found' && (
                            <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-1">
                              <span>ℹ️</span> EAN search completed.
                            </div>
                          )}
                        </div>

                        {/* 2. Product Name */}
                        <div className="md:col-span-5 space-y-1 text-left">
                          <label className="text-[11px] font-semibold text-slate-650 flex items-center justify-between">
                            <span>Product Name</span>
                            {productName.trim() && (
                              <button
                                type="button"
                                onClick={() => triggerAiDetailsAssist(productName, barcode)}
                                disabled={aiSuggesting}
                                className="text-[9px] bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 font-bold px-1.5 py-0.5 rounded-md border border-slate-200 hover:border-indigo-200 cursor-pointer"
                              >
                                {aiSuggesting ? 'Thinking...' : 'AI Assist'}
                              </button>
                            )}
                          </label>
                          <input
                            type="text"
                            required
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            onBlur={() => triggerAiDetailsAssist(productName, barcode)}
                            placeholder="e.g. Heinz Tomato Ketchup 300g"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 text-xs rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                          />
                          {barcodeLookupStatus === 'found' && googleFoundName && (
                            <div className="text-[10px] text-emerald-600 font-medium mt-1">
                              Found on Google: <strong className="font-bold">{googleFoundName}</strong>
                            </div>
                          )}
                        </div>

                        {/* 3. Quantity */}
                        <div className="md:col-span-2 space-y-1 text-left">
                          <label className="text-[11px] font-semibold text-slate-655">Quantity</label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 text-xs rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold"
                          />
                        </div>

                        {/* 4. Expiry Date */}
                        <div className="md:col-span-2 space-y-1 text-left">
                          <label className="text-[11px] font-semibold text-slate-655 flex items-center gap-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            required
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 text-xs rounded-lg focus:outline-hidden sm:text-xs font-mono font-medium text-slate-700"
                          />
                        </div>
                      </div>

                      {/* Dropdown Options for Return Reason */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                        
                        {/* Reasons selections */}
                        <div className="md:col-span-6 space-y-1 text-left">
                          <label className="text-[11px] font-semibold text-slate-655">Reason for return</label>
                          <select
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 text-xs rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10"
                          >
                            {COMMON_REASONS.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                            <option value="Other (Please specify)">Other (Please specify)</option>
                          </select>
                        </div>

                        {/* Custom reason conditional */}
                        {returnReason === 'Other (Please specify)' ? (
                          <div className="md:col-span-6 space-y-1 text-left animate-fade-in">
                            <label className="text-[11px] font-semibold text-slate-655">Specify other reason</label>
                            <input
                              type="text"
                              required
                              value={customReason}
                              onChange={(e) => setCustomReason(e.target.value)}
                              placeholder="Type detail, e.g., 'Container Seal Leak'"
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 text-xs rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>
                        ) : (
                          /* AI Suggested Reasons if available from API */
                          aiDetailsSuggestions.length > 0 && (
                            <div className="md:col-span-6 text-left">
                              <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase mb-1">AI Suggests reasons:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {aiDetailsSuggestions.map((sReason) => (
                                  <button
                                    key={sReason}
                                    type="button"
                                    onClick={() => setReturnReason(sReason)}
                                    className="text-[10px] bg-slate-100 hover:bg-indigo-55 hover:bg-indigo-55 hover:bg-indigo-50 text-slate-650 hover:text-indigo-700 font-semibold px-2 py-1 rounded-md border border-slate-200 cursor-pointer hover:border-indigo-300"
                                  >
                                    {sReason}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      {/* Barcode scanner preview if toggled */}
                      {showScanner && (
                        <div className="py-2 border-t border-dashed mt-2">
                          <BarcodeScanner 
                            onScan={handleBarcodeScanned} 
                            onClose={() => setShowScanner(false)} 
                          />
                        </div>
                      )}

                      {/* Guidance alert banner themed after the sleek design */}
                      <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100/60 flex items-start gap-2.5 text-xs text-indigo-800">
                        <Activity className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="text-left font-sans">
                          <p className="font-bold text-indigo-900">Standard Return Processing Standard</p>
                          <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                            Inventory added to this ledger draft will automatically align with vendor return codes. Please inspect seals and EAN barcodes before final submittal.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-150">
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider shadow-sm shadow-indigo-100"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                          Add Item to Ledger
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Return Note Items Table */}
                <div className="flex-1 p-5 md:p-6 text-left">
                  <h3 className="text-xs font-bold text-slate-450 uppercase mb-3 tracking-wider">
                    Catalogued Return Items ({noteItems.length} Total)
                  </h3>

                  {noteItems.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-3">
                      <div className="w-14 h-14 bg-slate-50 border border-slate-150 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Bookmark className="w-6 h-6 stroke-[1.5]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-600">No items registered in active note</p>
                        <p className="text-xs text-slate-450 max-w-sm mx-auto leading-relaxed mt-1">
                          {activeNote.status === 'completed'
                            ? "This return note is finalised and was saved with zero items."
                            : "Provide item specifications in the form above or launch the AI Bulk Text parser to populate this return note instantly."}
                        </p>
                      </div>
                      
                      {activeNote.status !== 'completed' && (
                        <button
                          onClick={() => setShowAIModal(true)}
                          className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border text-[11px] font-bold text-slate-800 py-1.5 px-3 rounded-lg transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 animate-pulse" />
                          Try AI Bulk Parser
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse font-sans text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold font-mono">
                            <th className="py-2.5 px-3">Product Title</th>
                            <th className="py-2.5 px-3">Barcode</th>
                            <th className="py-2.5 px-3 text-right">Quantity</th>
                            <th className="py-2.5 px-3 text-center">Expiry Date</th>
                            <th className="py-2.5 px-3">Return Reason</th>
                            {activeNote.status !== 'completed' && <th className="py-2.5 px-3 text-right">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {noteItems.map((item) => {
                            const ext = isDateExpired(item.expiryDate);
                            const near = isDateNearExpiry(item.expiryDate);
                            return (
                              <tr 
                                key={item.id} 
                                className={`hover:bg-slate-50/50 group ${
                                  ext ? 'bg-rose-50/20' : near ? 'bg-amber-50/10' : ''
                                }`}
                              >
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900 leading-normal">{item.productName}</div>
                                </td>
                                
                                <td className="py-3 px-3">
                                  <span className="font-mono text-slate-500 select-all">
                                    {item.barcode || <span className="text-[10px] text-slate-350 italic">None</span>}
                                  </span>
                                </td>

                                <td className="py-3 px-3 text-right">
                                  <span className="font-mono font-bold text-slate-800">{item.quantity}</span>
                                </td>

                                <td className="py-3 px-3 text-center">
                                  <div className="inline-flex flex-col items-center">
                                    <span className={`font-mono font-semibold px-2 py-0.5 rounded-sm text-[10px] ${
                                      ext 
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                        : near 
                                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                          : 'bg-slate-100 text-slate-705 border border-slate-200'
                                    }`}>
                                      {item.expiryDate}
                                    </span>
                                    {ext && <span className="text-[9px] text-rose-600 mt-0.5 font-bold animate-pulse">EXPIRED</span>}
                                    {near && <span className="text-[9px] text-amber-600 mt-0.5 font-bold">NEAR EXP</span>}
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-slate-650 max-w-64">
                                  <p className="truncate" title={item.reason}>{item.reason}</p>
                                </td>

                                {activeNote.status !== 'completed' && (
                                  <td className="py-3 px-3 text-right">
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-all cursor-pointer opacity-80 md:opacity-40 md:hover:opacity-100 shrink-0"
                                      title="Delete Product Entry"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Sticky note compiler summary footer instructions */}
                <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex justify-between items-center text-[11px] text-slate-500 flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Always verify EAN numbers against standard barcodes to accelerate distributor refunds.</span>
                  </div>
                  <div>
                    <span>Registry Version 1.0 (Enterprise Client)</span>
                  </div>
                </div>

              </div>
            ) : (
              /* EMPTY ACTIVE STATE VIEWPORT */
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 min-h-96">
                <div className="max-w-md text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-650 flex items-center justify-center mx-auto shadow-sm">
                    <ClipboardCheck className="w-8 h-8 stroke-[1.8]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-800">No Return Note Loaded</h3>
                    <p className="text-xs text-slate-450 leading-relaxed">
                      Select an existing return note from the left sidebar ledger, or draft a brand-new compilation catalog at the top of the ledger.
                    </p>
                  </div>
                  
                  {notes.length === 0 && (
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-dashed border-indigo-100 text-xs text-slate-650 max-w-sm mx-auto leading-relaxed">
                      <p className="font-semibold text-indigo-900">Quickstart Tip:</p>
                      Enter a name title like "Heinz Batch - Q2" inside the input form on the left pane and tap key <kbd className="bg-white border rounded px-1 font-mono text-[10px] shadow-2xs font-bold">↵ Enter</kbd> to begin.
                    </div>
                  )}

                  {/* Sandbox setup notice */}
                  <div className="text-[10px] text-slate-400 font-mono">
                    Authenticated as UID: <span className="font-semibold underline text-slate-600">{getEffectiveUID()}</span>
                  </div>
                </div>
              </div>
            )}
          </main>

        </div>
      )}

      {/* Sleek Footing Ledger as requested in the Theme Spec */}
      <footer className="h-12 bg-white border-t border-slate-200 px-4 md:px-8 flex items-center justify-between text-[11px] font-sans text-slate-500 shrink-0 mt-auto">
        <div className="flex gap-6 uppercase tracking-wider text-slate-400 font-bold font-mono">
          <span>Version 2.4.1</span>
          <span className="text-slate-200">|</span>
          <span>Support Hotline: 1-800-INV-LOGS</span>
        </div>
        <div className="flex gap-4">
          <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors">System Status</a>
          <span className="text-slate-250">|</span>
          <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors">Privacy Policy</a>
        </div>
      </footer>

      {/* Bulk AI text Parser Modal */}
      <AIImportModal 
        isOpen={showAIModal} 
        onClose={() => setShowAIModal(false)} 
        onImport={handleAIBulkImport} 
      />

      {/* Custom non-blocking Delete Note Modal */}
      {confirmDeleteNoteId && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-subtle flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-205 border-slate-200 p-6 shadow-xl animate-fade-in text-left">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 mb-4">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-950 mb-2">
              Delete Return Note Draft?
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Are you absolutely sure you want to delete this return note draft? All registered product entries and barcodes inside this list will be permanently purged.
            </p>

            <div className="flex justify-end gap-3 font-semibold text-xs">
              <button
                type="button"
                onClick={() => setConfirmDeleteNoteId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-250 text-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                No, Keep Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteNote(confirmDeleteNoteId);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Yes, Delete Permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom non-blocking Complete Note Lock Modal */}
      {confirmCompleteNoteOpen && activeNote && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-subtle flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-205 border-slate-200 p-6 shadow-xl animate-fade-in text-left">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
              <Lock className="w-6 h-6" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-950 mb-2">
              Complete & Lock Return Note?
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Once marked as <strong>Completed</strong>, this note will be permanently logged and locked from any future edits or deletions. This certifies distributor return compliance.
            </p>

            <div className="flex justify-end gap-3 font-semibold text-xs">
              <button
                type="button"
                onClick={() => setConfirmCompleteNoteOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-250 text-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel, Keep Editing
              </button>
              <button
                type="button"
                onClick={handleCompleteNote}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirm Complete & Lock
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
