// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, runTransaction, query, where } from 'firebase/firestore';
import { 
  Users, Package, Printer, BookOpen, LogOut, Search, AlertTriangle, 
  Plus, Minus, Edit2, Trash2, RotateCcw, AlertCircle, ShieldCheck, RefreshCw,
  Wrench, Calendar, CheckCircle2, MessageSquare
} from 'lucide-react';

// ==========================================
// 1. KONFIGURASI FIREBASE & ROOT COLLECTIONS
// ==========================================
const USE_ROOT_COLLECTIONS = true; 

const firebaseConfig = {
  apiKey: "AIzaSyBDyw6abBksq1UhduuoH-XJ8YCq-GkWFv8",
  authDomain: "mandiri-clothing-webapp.firebaseapp.com",
  projectId: "mandiri-clothing-webapp",
  storageBucket: "mandiri-clothing-webapp.firebasestorage.app",
  messagingSenderId: "360243309180",
  appId: "1:360243309180:web:65d4fff8ec8adc152037f9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mandiri-clothing';

const getColPath = (colName) => {
  return USE_ROOT_COLLECTIONS ? colName : `artifacts/${appId}/public/data/${colName}`;
};

// ==========================================
// 2. STYLING INJECTION (Urbanist Font & Global Fix)
// ==========================================
const GlobalStyle = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800;900&display=swap');
    
    html, body, #root {
      width: 100%;
      height: 100%;
      height: 100dvh; /* Mobile viewport fix */
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: 'Urbanist', sans-serif;
      background-color: #0A0A0A;
      color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .glass-card { background: #171717; border: 1px solid #262626; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3); }
    input, select, textarea { font-family: 'Urbanist', sans-serif; }
    
    @keyframes modalFade {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .animate-modal { animation: modalFade 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  `}} />
);

const formatRp = (angka) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
};

const generateID = (prefix) => {
  return `${prefix}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
};

// ==========================================
// 3. MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [appUser, setAppUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('mc_core_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch { return null; }
  }); 

  const [activeTab, setActiveTab] = useState('press'); // Default to Press
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, undoAction = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, undoAction });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const handleAppLogin = (user) => {
    setAppUser(user);
    if (user) localStorage.setItem('mc_core_user', JSON.stringify(user));
    else localStorage.removeItem('mc_core_user');
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch {
        setErrorMsg("Koneksi Firebase Gagal. Cek koneksi internet atau setelan autentikasi.");
        setLoading(false);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if(user) { setLoading(false); setErrorMsg(null); }
    });
    return () => unsubscribe();
  }, []);

  if (errorMsg) return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center w-full h-full z-50">
      <GlobalStyle />
      <AlertCircle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
      <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest mb-2">SYSTEM ERROR</h1>
      <p className="text-red-400 font-bold max-w-md text-sm md:text-base">{errorMsg}</p>
    </div>
  );

  if (loading) return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center font-bold text-yellow-400 w-full h-full z-50">
      <GlobalStyle />
      <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
      <span className="uppercase tracking-widest text-xs animate-pulse">Menghubungkan ke System...</span>
    </div>
  );

  if (!appUser) return <><GlobalStyle /><LoginScreen onLogin={handleAppLogin} /></>;

  const canAccess = (modul) => appUser.role === 'admin' || appUser.hakAkses?.includes(modul);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0A0A0A] text-white flex flex-col md:flex-row overflow-hidden selection:bg-yellow-400 selection:text-black">
      <GlobalStyle />
      
      {/* PERFECTLY CENTERED TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-0 left-0 right-0 z-[60] mt-4 flex justify-center pointer-events-none px-4">
          <div className="bg-[#171717] border border-yellow-400 shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-3 md:p-4 rounded-2xl flex items-center gap-3 animate-modal pointer-events-auto max-w-full w-max">
            <CheckCircle2 className="w-5 h-5 text-yellow-400 shrink-0" />
            <span className="text-xs md:text-sm font-bold leading-tight">{toast.msg}</span>
            {toast.undoAction && (
              <button onClick={toast.undoAction} className="ml-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 text-[10px] md:text-xs font-black uppercase flex items-center gap-1 shrink-0 border border-red-500/20 transition-colors">
                <RotateCcw className="w-3 h-3" /> BATAL
              </button>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden order-1 md:order-2">
        {/* Mobile Top Header */}
        <header className="md:hidden w-full bg-[#171717] p-4 flex justify-between items-center border-b border-[#262626] shrink-0 z-30 shadow-md relative">
           <div className="min-w-0 flex-1">
             <h1 className="text-xl font-black tracking-tighter uppercase truncate"><span className="text-yellow-400">MC</span> Core</h1>
             <p className="text-[10px] text-yellow-400 uppercase font-bold tracking-widest leading-none flex items-center gap-1 mt-1.5 truncate"><ShieldCheck size={12} className="shrink-0"/> <span className="truncate">{appUser.nama} ({appUser.role})</span></p>
           </div>
           <button onClick={() => handleAppLogin(null)} className="ml-3 text-red-500 p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 active:scale-95 transition-transform shrink-0"><LogOut className="w-5 h-5" /></button>
        </header>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto relative bg-[#0A0A0A]">
          {activeTab === 'karyawan' && <ModulKaryawan currentUser={appUser} showToast={showToast} />}
          {activeTab === 'press' && <ModulInventoriPress currentUser={appUser} showToast={showToast} />}
          {activeTab === 'print' && <ModulInventoriPrint currentUser={appUser} showToast={showToast} />}
          {activeTab === 'katalog' && <ModulKatalog currentUser={appUser} showToast={showToast} />}
        </div>
      </main>

      {/* Navigation Menu */}
      <nav className="bg-[#171717] border-t md:border-t-0 md:border-r border-[#262626] w-full md:w-64 flex md:flex-col justify-around md:justify-start pb-[env(safe-area-inset-bottom,0px)] shrink-0 z-40 order-2 md:order-1 relative shadow-[0_-10px_20px_rgba(0,0,0,0.5)] md:shadow-none">
        <div className="hidden md:block p-6 border-b border-[#262626]">
          <h1 className="text-3xl font-black tracking-tighter uppercase"><span className="text-yellow-400">MC</span> Core</h1>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Data & Inventory</p>
        </div>

        <div className="flex md:flex-col w-full px-2 py-2 md:p-4 gap-1 md:gap-3 overflow-x-auto hide-scrollbar">
          {canAccess('karyawan') && <NavItem icon={Users} label="KARYAWAN" active={activeTab === 'karyawan'} onClick={() => setActiveTab('karyawan')} />}
          {canAccess('press') && <NavItem icon={Package} label="INV. PRESS" active={activeTab === 'press'} onClick={() => setActiveTab('press')} />}
          {canAccess('print') && <NavItem icon={Printer} label="INV. PRINT" active={activeTab === 'print'} onClick={() => setActiveTab('print')} />}
          {canAccess('katalog') && <NavItem icon={BookOpen} label="KATALOG" active={activeTab === 'katalog'} onClick={() => setActiveTab('katalog')} />}
        </div>

        <div className="hidden md:block mt-auto p-4 border-t border-[#262626]">
          <div className="bg-[#0A0A0A] rounded-2xl p-4 border border-[#262626]">
            <p className="text-yellow-400 font-black uppercase text-sm truncate flex items-center gap-1.5"><ShieldCheck size={16}/> {appUser.nama}</p>
            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mt-1.5">{appUser.role} • {appUser.posisi || 'Root'}</p>
          </div>
          <button onClick={() => handleAppLogin(null)} className="mt-3 w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-500/10 p-3.5 rounded-2xl transition-colors text-xs font-black uppercase border border-transparent hover:border-red-500/30">
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>
      </nav>
    </div>
  );
}

const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 p-2.5 md:p-4 rounded-2xl transition-all flex-1 md:flex-none border shrink-0 min-w-[70px] ${
      active ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'text-neutral-500 border-transparent hover:bg-[#262626] hover:text-white'
    }`}
  >
    <Icon className={`w-5 h-5 md:w-5 md:h-5 ${active ? 'text-black' : ''}`} />
    <span className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-center leading-tight">{label}</span>
  </button>
);

// ==========================================
// REUSABLE UPDATE STOCK MODAL (Super UX Friendly)
// ==========================================
function StockActionModal({ item, type, onClose, onSubmit }) {
  const [qty, setQty] = useState('');
  const [action, setAction] = useState(type); // 'IN' atau 'OUT'
  const [catatan, setCatatan] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!qty || isNaN(qty) || Number(qty) <= 0) return alert('Masukkan jumlah yang valid!');
    onSubmit(Number(qty), action, catatan);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-black/80 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-[#171717] border border-[#262626] rounded-[32px] w-full max-w-sm p-6 shadow-2xl animate-modal relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-[#0A0A0A] p-2 rounded-full transition-colors"><Plus className="w-5 h-5 rotate-45"/></button>
        
        <h3 className="text-lg font-black uppercase tracking-tight mb-1 text-center">Update Stok</h3>
        <p className="text-yellow-400 text-sm font-bold text-center mb-6 px-4 truncate">{item.nama}</p>

        {/* Toggle IN / OUT */}
        <div className="flex bg-[#0A0A0A] p-1.5 rounded-2xl border border-[#262626] mb-5">
          <button type="button" onClick={() => setAction('IN')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${action === 'IN' ? 'bg-green-500/20 text-green-500' : 'text-neutral-500 hover:bg-[#262626]'}`}>Stok Masuk</button>
          <button type="button" onClick={() => setAction('OUT')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${action === 'OUT' ? 'bg-red-500/20 text-red-500' : 'text-neutral-500 hover:bg-[#262626]'}`}>Keluar / Pakai</button>
        </div>

        <div className="mb-4">
          <label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest text-center">Kuantitas ({item.satuan})</label>
          <input type="number" value={qty} onChange={e=>setQty(e.target.value)} required step="0.1" min="0.1"
            className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-3xl text-center font-black text-white focus:outline-none focus:border-yellow-400 transition-all placeholder:text-neutral-700" placeholder="0" autoFocus />
        </div>

        <div className="mb-6">
          <label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Catatan (Opsional)</label>
          <div className="relative">
            <MessageSquare className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input type="text" value={catatan} onChange={e=>setCatatan(e.target.value)} 
              className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl pl-10 pr-4 py-3.5 text-xs font-semibold text-white focus:outline-none focus:border-yellow-400 transition-all placeholder:text-neutral-600" placeholder="Cth: Restock Supplier A..." />
          </div>
        </div>

        <button type="submit" className={`w-full font-black py-4 rounded-2xl text-sm uppercase tracking-widest active:scale-95 transition-all ${action === 'IN' ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:bg-green-600' : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:bg-red-600'}`}>
          Simpan Transaksi
        </button>
      </form>
    </div>
  );
}

// ==========================================
// LOGIN SCREEN 
// ==========================================
function LoginScreen({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    
    if (user.toLowerCase() === 'admin' && pass === 'masteradmin') {
      onLogin({ id: 'SYS_ADMIN', nama: 'Super Admin', role: 'admin', posisi: 'Root', hakAkses: ['karyawan', 'press', 'print', 'katalog'] });
      return;
    }

    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, getColPath('karyawan')));
      const allKaryawan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const found = allKaryawan.find(k => k.username.toLowerCase() === user.toLowerCase() && k.password === pass);
      if (found) onLogin(found);
      else setErr('Username atau Password salah!');
    } catch { setErr('Gagal memeriksa data ke server. Coba lagi.'); } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center p-4 w-full h-full z-50">
      <div className="w-full max-w-sm bg-[#171717] border border-[#262626] p-6 md:p-8 rounded-[32px] shadow-2xl relative overflow-hidden animate-modal">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-400/20 blur-[60px] rounded-full pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <h1 className="text-4xl font-black tracking-tighter uppercase"><span className="text-yellow-400">MC</span> Core</h1>
          <p className="text-neutral-500 text-xs mt-2 font-bold uppercase tracking-widest">Enterprise Data System</p>
        </div>
        
        {err && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-2xl text-xs font-bold mb-6 text-center flex items-center justify-center gap-2"><AlertCircle size={14}/> {err}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          <div>
            <label className="block text-[10px] font-black text-neutral-400 mb-1.5 uppercase tracking-widest">Username Akses</label>
            <input type="text" value={user} onChange={e=>setUser(e.target.value)} required 
              className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:outline-none focus:border-yellow-400 transition-all placeholder:text-neutral-700" placeholder="Ketik username..." />
          </div>
          <div>
            <label className="block text-[10px] font-black text-neutral-400 mb-1.5 uppercase tracking-widest">Password</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} required 
              className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:outline-none focus:border-yellow-400 transition-all placeholder:text-neutral-700" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(250,204,21,0.3)] mt-6 text-sm uppercase tracking-widest active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50">
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Masuk Ke Sistem'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// MODUL KARYAWAN 
// ==========================================
function ModulKaryawan({ currentUser, showToast }) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '', originalId: null, nama: '', hp: '', username: '', password: '', email: '', 
    jabatan: 'produksi', posisi: 'Jahit', role: 'produksi', 
    hakAkses: { karyawan: false, press: false, print: false, katalog: false }
  });

  const isAdmin = currentUser.role === 'admin';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, getColPath('karyawan')));
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { showToast("Gagal memuat data karyawan."); } finally { setIsLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showToast("Akses ditolak!");
    const aksesArray = Object.keys(formData.hakAkses).filter(k => formData.hakAkses[k]);
    const docData = { ...formData, hakAkses: aksesArray };
    delete docData.originalId; 
    try {
      if (formData.originalId && formData.originalId !== formData.id) await deleteDoc(doc(db, getColPath('karyawan'), formData.originalId));
      await setDoc(doc(db, getColPath('karyawan'), formData.id), docData);
      showToast(`User ${formData.nama} disimpan!`);
      setIsModalOpen(false); fetchData(); 
    } catch { showToast("Error simpan data!"); }
  };

  const handleDelete = async (id) => {
    if(confirm('Yakin hapus karyawan ini permanen?')) {
      await deleteDoc(doc(db, getColPath('karyawan'), id)); showToast("Karyawan dihapus!"); fetchData(); 
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Wrapper */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A] pt-4 md:pt-8 px-4 md:px-8 pb-4 border-b border-[#262626]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Manajemen <span className="text-yellow-400">Staff</span></h2>
            <p className="text-neutral-500 text-[10px] md:text-xs font-semibold mt-1">Kelola data user dan hak akses sistem.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={fetchData} className="p-3.5 md:p-3 bg-[#171717] border border-[#262626] rounded-xl hover:bg-[#262626] transition-colors shrink-0">
               <RefreshCw className={`w-4 h-4 text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && (
              <button onClick={() => { setFormData({ id: generateID('MC-'), originalId: null, nama: '', hp: '', username: '', password: '', email: '', jabatan: 'produksi', posisi: 'Jahit', role: 'produksi', hakAkses: { karyawan: false, press: false, print: false, katalog: false }}); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-yellow-400 text-black px-4 md:px-5 py-3.5 md:py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-500 font-black text-[10px] md:text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                <Plus className="w-4 h-4" /> Tambah Staff
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 px-4 md:px-8 pb-10">
        {isLoading ? ( <div className="text-center py-10 text-neutral-500 text-xs font-bold uppercase tracking-widest animate-pulse">Memuat data...</div> ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 pb-4">
            {data.map(k => (
              <div key={k.id} className="glass-card rounded-[20px] md:rounded-[24px] p-4 md:p-5 relative group flex flex-col justify-between">
                {isAdmin && (
                  <div className="absolute top-3 right-3 md:top-4 md:right-4 flex gap-1 z-10">
                    <button onClick={() => { const aksesObj = { karyawan: false, press: false, print: false, katalog: false }; (k.hakAkses || []).forEach(h => aksesObj[h] = true); setFormData({ ...k, hakAkses: aksesObj, originalId: k.id }); setIsModalOpen(true); }} className="p-2 bg-[#0A0A0A] border border-[#262626] text-neutral-400 hover:text-yellow-400 hover:border-yellow-400 rounded-lg md:rounded-xl transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={() => handleDelete(k.id)} className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg md:rounded-xl transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                )}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 mb-4 pt-8 md:pt-0">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#0A0A0A] border border-[#262626] flex items-center justify-center text-lg md:text-xl font-black text-yellow-400 shadow-inner shrink-0">{k.nama.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 w-full">
                    <h3 className="font-bold text-base md:text-lg leading-tight truncate">{k.nama}</h3>
                    <p className="text-[9px] md:text-[10px] text-neutral-500 font-bold tracking-widest uppercase mt-1 truncate">{k.id}</p>
                  </div>
                </div>
                <div className="space-y-2 md:space-y-2.5 text-[10px] md:text-xs font-semibold mt-auto border-t border-[#262626]/50 pt-3 md:pt-4">
                  <div className="flex justify-between items-center"><span className="text-neutral-500 uppercase tracking-widest text-[9px]">Role</span><span className="text-yellow-400 uppercase tracking-widest font-black text-[9px] md:text-[10px] bg-yellow-400/10 px-2 py-0.5 rounded-md">{k.role}</span></div>
                  <div className="flex justify-between items-center"><span className="text-neutral-500 uppercase tracking-widest text-[9px]">Posisi</span><span className="uppercase tracking-widest text-neutral-300 truncate text-right">{k.posisi}</span></div>
                  <div className="flex justify-between items-center"><span className="text-neutral-500 uppercase tracking-widest text-[9px]">User</span><span className="font-mono text-neutral-300 truncate text-right">{k.username}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#171717] border border-[#262626] rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-modal hide-scrollbar relative">
            <div className="p-5 md:p-6 border-b border-[#262626] flex justify-between items-center sticky top-0 bg-[#171717]/95 backdrop-blur z-10">
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight">{formData.originalId ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white bg-[#0A0A0A] p-2.5 rounded-full border border-[#262626]"><Plus className="w-5 h-5 rotate-45"/></button>
            </div>
            <form onSubmit={handleSave} className="p-5 md:p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">ID</label><input type="text" value={formData.id} onChange={e=>setFormData({...formData, id: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 md:p-3 text-sm font-semibold text-white outline-none focus:border-yellow-400" required /></div>
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Nama</label><input type="text" value={formData.nama} onChange={e=>setFormData({...formData, nama: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 md:p-3 text-sm font-semibold text-white outline-none focus:border-yellow-400" required /></div>
                <div className="col-span-1 md:col-span-2 pt-4 border-t border-[#262626]"><h4 className="text-yellow-400 font-black text-sm uppercase tracking-widest mb-2">Sistem Akses</h4></div>
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Username</label><input type="text" value={formData.username} onChange={e=>setFormData({...formData, username: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 md:p-3 text-sm font-semibold text-white outline-none focus:border-yellow-400" required /></div>
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Password</label><input type="text" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 md:p-3 text-sm font-semibold text-white outline-none focus:border-yellow-400" required /></div>
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Role</label><select value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 md:p-3 text-sm font-semibold text-white outline-none focus:border-yellow-400 uppercase appearance-none"><option value="produksi">Produksi</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Posisi</label><select value={formData.posisi} onChange={e=>setFormData({...formData, posisi: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 md:p-3 text-sm font-semibold text-white outline-none focus:border-yellow-400 uppercase appearance-none"><option value="CS">CS</option><option value="Print">Print</option><option value="Press">Press</option><option value="Jahit">Jahit</option></select></div>
              </div>
              <div className="pt-2">
                <label className="text-[10px] text-neutral-400 font-bold mb-3 block uppercase tracking-widest">Hak Akses Modul</label>
                <div className="grid grid-cols-2 gap-3">
                  {['karyawan', 'press', 'print', 'katalog'].map(modul => (
                    <label key={modul} className="flex items-center gap-3 bg-[#0A0A0A] border border-[#262626] p-4 md:p-3 rounded-2xl cursor-pointer hover:border-yellow-400 transition-colors">
                      <input type="checkbox" checked={formData.hakAkses[modul]} onChange={e => setFormData({...formData, hakAkses: {...formData.hakAkses, [modul]: e.target.checked}})} className="accent-yellow-400 w-5 h-5 md:w-4 md:h-4 rounded" />
                      <span className="text-xs font-bold uppercase tracking-wider">{modul}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-[#262626] flex flex-col-reverse md:flex-row justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full md:w-auto px-6 py-4 md:py-3 rounded-2xl text-neutral-400 font-bold hover:bg-[#0A0A0A] text-xs uppercase tracking-widest">Batal</button>
                <button type="submit" className="w-full md:w-auto px-6 py-4 md:py-3 rounded-2xl bg-yellow-400 text-black font-black hover:bg-yellow-500 text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.2)]">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODUL INVENTORI PRESS
// ==========================================
function ModulInventoriPress({ currentUser, showToast }) {
  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [mesinLogs, setMesinLogs] = useState([]);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateItem, setUpdateItem] = useState(null);
  const [updateType, setUpdateType] = useState('IN');

  const [mesinModalOpen, setMesinModalOpen] = useState(false);
  const [mesinForm, setMesinForm] = useState({ jenisTreatment: 'service', catatan: '', tanggalTreatment: new Date().toISOString().split('T')[0] });

  const [subTab, setSubTab] = useState('stok');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  const isAdmin = currentUser.role === 'admin';
  const canEditStock = isAdmin || (currentUser.role === 'produksi' && currentUser.posisi === 'Press');

  useEffect(() => {
    const unsubPress = onSnapshot(collection(db, getColPath('inventori_press')), (snap) => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error fetching press:", err));
    return () => unsubPress();
  }, []);

  const fetchLogs = useCallback(async (tab) => {
    setIsLoadingLogs(true);
    try {
      const logType = tab === 'log' ? 'press' : 'mesin_press';
      const snap = await getDocs(query(
        collection(db, getColPath('log_transaksi')),
        where('type', '==', logType)
      ));
      const allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp - a.timestamp);
      
      if (tab === 'log') {
        setLogs(allLogs);
      } else if (tab === 'log_mesin') {
        setMesinLogs(allLogs);
      }
    } catch { showToast("Gagal memuat log"); } finally { setIsLoadingLogs(false); }
  }, [showToast]);

  useEffect(() => {
    if (subTab === 'log' || subTab === 'log_mesin') fetchLogs(subTab);
  }, [fetchLogs, subTab]);

  const normalizedSearch = search.toLowerCase();
  const filteredData = useMemo(() => data.filter(d => d.nama.toLowerCase().includes(normalizedSearch) || d.id.toLowerCase().includes(normalizedSearch)), [data, normalizedSearch]);
  const lowStock = useMemo(() => data.filter(d => Number(d.stok) <= 1 && Number(d.stok) > 0), [data]);
  const emptyStock = useMemo(() => data.filter(d => Number(d.stok) === 0), [data]);

  const openUpdateAction = (item, type) => {
    if(!canEditStock) return;
    setUpdateItem(item);
    setUpdateType(type);
    setUpdateModalOpen(true);
  };

  const handleExecuteUpdate = async (qty, actionType, catatan) => {
    const val = Number(qty);
    const itemRef = doc(db, getColPath('inventori_press'), updateItem.id);
    const logId = `LOG-${Date.now()}`;
    const logRef = doc(db, getColPath('log_transaksi'), logId);

    try {
      await runTransaction(db, async (transaction) => {
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) throw new Error('Item tidak ditemukan');
        const currentStock = Number(itemSnap.data().stok || 0);
        const nextStock = actionType === 'IN' ? currentStock + val : currentStock - val;
        if (nextStock < 0) throw new Error('Stok tidak boleh minus');
        transaction.update(itemRef, { stok: nextStock });
        transaction.set(logRef, {
          id: logId, type: 'press', itemId: updateItem.id, itemNama: updateItem.nama,
          action: actionType, qty: val, catatan: catatan || '-', user: currentUser.nama, timestamp: Date.now()
        });
      });
      setUpdateModalOpen(false);
      const undoFn = async () => {
        await runTransaction(db, async (transaction) => {
          const logSnap = await transaction.get(logRef);
          if (!logSnap.exists()) return;
          const itemSnap = await transaction.get(itemRef);
          if (!itemSnap.exists()) throw new Error('Item tidak ditemukan');
          const currentStock = Number(itemSnap.data().stok || 0);
          const revertedStock = currentStock + (actionType === 'IN' ? -val : val);
          if (revertedStock < 0) throw new Error('Stok tidak boleh minus');
          transaction.update(itemRef, { stok: revertedStock });
          transaction.delete(logRef);
        });
        showToast("Tindakan dibatalkan (Undo).");
      };
      showToast(`Stok ${updateItem.nama} berhasil diupdate.`, undoFn);
    } catch { showToast("Gagal update stok!"); }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const docId = editingData.originalId || generateID('K-');
    try {
      if (editingData.originalId && editingData.originalId !== editingData.id) await deleteDoc(doc(db, getColPath('inventori_press'), editingData.originalId));
      await setDoc(doc(db, getColPath('inventori_press'), editingData.id || docId), {
        id: editingData.id || docId, nama: editingData.nama, stok: Number(editingData.stok), satuan: editingData.satuan, cost: Number(editingData.cost)
      });
      setIsModalOpen(false); showToast("Kain berhasil disimpan!");
    } catch { showToast("Gagal simpan data!"); }
  };

  const handleSaveLogMesin = async (e) => {
    e.preventDefault();
    const logId = `LOGMESINPRESS-${Date.now()}`;
    const payload = {
      id: logId, type: 'mesin_press', user: currentUser.nama, timestamp: Date.now(),
      tanggalInput: Date.now(), tanggalTreatment: mesinForm.tanggalTreatment,
      jenisTreatment: mesinForm.jenisTreatment, catatan: mesinForm.catatan
    };
    try {
      await setDoc(doc(db, getColPath('log_transaksi'), logId), payload);
      setMesinModalOpen(false); showToast("Log Mesin Press tersimpan!"); fetchLogs('log_mesin');
    } catch { showToast("Gagal simpan log!"); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* PERFECT STICKY HEADER WRAPPER - Menyeluruh */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-xl pt-4 md:pt-8 px-4 md:px-8 pb-3 border-b border-[#262626] flex flex-col gap-4">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Inventori <span className="text-yellow-400">Kain</span></h2>
            <p className="text-neutral-500 text-[10px] md:text-xs font-semibold mt-1">Kelola stok roll/kg bahan press.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input type="text" placeholder="Cari kain..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full bg-[#171717] border border-[#262626] rounded-xl md:rounded-2xl pl-10 md:pl-11 pr-4 py-3.5 md:py-3 text-xs md:text-sm font-bold text-white focus:border-yellow-400 outline-none placeholder:text-neutral-600" />
            </div>
            {isAdmin && subTab === 'stok' && (
              <button onClick={() => { setEditingData({ id:generateID('K-'), originalId: null, nama:'', stok:0, satuan:'Roll', cost:0 }); setIsModalOpen(true); }} className="bg-yellow-400 text-black px-4 py-3.5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-yellow-500 shrink-0 font-black shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-transform">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
            {canEditStock && subTab === 'log_mesin' && (
              <button onClick={() => { setMesinForm({jenisTreatment:'service', catatan:'', tanggalTreatment:new Date().toISOString().split('T')[0]}); setMesinModalOpen(true); }} className="bg-yellow-400 text-black px-4 py-3.5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-yellow-500 shrink-0 font-black shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-transform gap-2">
                <Plus className="w-4 h-4" /> Catat
              </button>
            )}
          </div>
        </div>

        {/* Tabs - Di dalam sticky wrapper */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button onClick={() => setSubTab('stok')} className={`whitespace-nowrap px-5 py-3 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border shrink-0 ${subTab === 'stok' ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-[#171717] text-neutral-500 border-[#262626] hover:bg-[#262626]'}`}>Stok Kain</button>
          <button onClick={() => setSubTab('log')} className={`whitespace-nowrap px-5 py-3 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border shrink-0 ${subTab === 'log' ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-[#171717] text-neutral-500 border-[#262626] hover:bg-[#262626]'}`}>Log Aktivitas</button>
          <button onClick={() => setSubTab('log_mesin')} className={`whitespace-nowrap px-5 py-3 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border shrink-0 flex items-center gap-1.5 ${subTab === 'log_mesin' ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-[#171717] text-neutral-500 border-[#262626] hover:bg-[#262626]'}`}><Wrench className="w-3.5 h-3.5"/> Mesin Press</button>
        </div>

        {/* Warning Indicator - Posisi di bawah tab, tetap sticky */}
        {(emptyStock.length > 0 || lowStock.length > 0) && subTab === 'stok' && (
          <div className="bg-[#171717]/80 backdrop-blur border border-[#262626] rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 animate-pulse" />
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white">Status Stok Perlu Perhatian</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {emptyStock.map(s => (
                <div key={s.id} className="bg-red-500/10 border border-red-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">{s.nama} (KOSONG)</span>
                </div>
              ))}
              {lowStock.map(s => (
                <div key={s.id} className="bg-yellow-400/10 border border-yellow-400/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-widest">{s.nama} ({s.stok})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Scroll Area */}
      <div className="pt-4 px-4 md:px-8 pb-10">
        {subTab === 'stok' ? (
        // Grid Card Stok
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {filteredData.map(item => {
            const isOut = Number(item.stok) === 0;
            const isLow = Number(item.stok) <= 1 && !isOut;
            return (
              <div key={item.id} className={`glass-card rounded-[20px] md:rounded-[24px] p-3.5 md:p-5 relative flex flex-col justify-between transition-all ${isOut ? 'border-red-500/50 bg-red-950/10' : isLow ? 'border-orange-500/30' : ''}`}>
                
                {/* Absolute Badge & Admin Actions */}
                <div className="absolute top-3.5 right-3.5 md:top-4 md:right-4 flex gap-1 z-10">
                  {isOut ? <span className="bg-red-500 text-white text-[8px] md:text-[9px] px-2 py-0.5 md:px-2.5 md:py-1 rounded-md font-black uppercase tracking-widest animate-pulse">KOSONG</span> :
                   isLow ? <span className="bg-orange-500 text-black text-[8px] md:text-[9px] px-2 py-0.5 md:px-2.5 md:py-1 rounded-md font-black uppercase tracking-widest">MENIPIS</span> : null}
                   
                  {isAdmin && (
                     <button onClick={() => { setEditingData({ ...item, originalId: item.id }); setIsModalOpen(true); }} className="p-1.5 md:p-2 bg-[#0A0A0A] hover:bg-yellow-400 hover:text-black rounded-lg text-neutral-400 transition-colors border border-[#262626]"><Edit2 className="w-3 h-3 md:w-3.5 md:h-3.5"/></button>
                  )}
                </div>

                <div>
                  <p className="text-[9px] md:text-[10px] text-neutral-500 font-black tracking-widest uppercase mb-1 truncate w-[70%]">{item.id}</p>
                  <h3 className={`font-bold text-sm md:text-lg leading-tight mb-3 pr-10 break-words line-clamp-2 min-h-[2.5rem] ${isOut ? 'text-red-400' : 'text-white'}`}>{item.nama}</h3>
                  
                  <div className="flex items-baseline gap-1 md:gap-1.5 mb-1.5">
                    <span className={`text-4xl md:text-5xl font-black tracking-tighter ${isOut ? 'text-red-500' : isLow ? 'text-orange-400' : 'text-yellow-400'}`}>{item.stok}</span>
                    <span className="text-neutral-500 font-bold text-[10px] md:text-xs uppercase tracking-widest">{item.satuan}</span>
                  </div>
                  {isAdmin && <p className="text-[9px] md:text-[10px] text-neutral-500 font-bold uppercase tracking-widest truncate">Cost: {formatRp(item.cost)}</p>}
                </div>

                {canEditStock && (
                  <div className="flex w-full gap-2 mt-4 pt-4 border-t border-[#262626]">
                    <button onClick={() => openUpdateAction(item, 'OUT')} className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white py-2.5 rounded-xl flex justify-center font-black transition-colors active:scale-95"><Minus className="w-4 h-4 md:w-5 md:h-5"/></button>
                    <button onClick={() => openUpdateAction(item, 'IN')} className="flex-1 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white py-2.5 rounded-xl flex justify-center font-black transition-colors active:scale-95"><Plus className="w-4 h-4 md:w-5 md:h-5"/></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        ) : subTab === 'log' ? (
          <div className="glass-card rounded-xl md:rounded-[24px] overflow-hidden">
            {isLoadingLogs ? (
              <div className="p-8 text-center text-yellow-400 text-xs font-bold uppercase tracking-widest animate-pulse">Menarik data log stok...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 font-bold uppercase tracking-widest text-xs">Belum ada log stok.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={log.id} className={`p-4 md:p-5 flex justify-between items-center gap-3 hover:bg-[#262626]/30 transition-colors ${idx !== logs.length -1 ? 'border-b border-[#262626]' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] md:text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">{new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <h4 className="font-bold text-white text-sm md:text-base leading-tight truncate pr-2 mb-1">{log.itemNama}</h4>
                    {log.catatan && log.catatan !== '-' && (
                      <p className="text-[10px] md:text-xs text-neutral-400 italic flex items-center gap-1.5 mt-1.5"><MessageSquare className="w-3 h-3"/> {log.catatan}</p>
                    )}
                    <p className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest mt-2">Oleh: <span className="text-yellow-400">{log.user}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xl md:text-2xl font-black ${log.action === 'IN' ? 'text-green-500' : 'text-red-500'}`}>{log.action === 'IN' ? '+' : '-'}{log.qty}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${log.action === 'IN' ? 'text-green-500/70' : 'text-red-500/70'}`}>{log.action === 'IN' ? 'MASUK' : 'KELUAR'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="glass-card rounded-xl md:rounded-[24px] overflow-hidden">
            {isLoadingLogs ? (
              <div className="p-8 text-center text-yellow-400 text-xs font-bold uppercase tracking-widest animate-pulse">Menarik log mesin...</div>
            ) : mesinLogs.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 font-bold uppercase tracking-widest text-xs">Belum ada catatan maintenance mesin press.</div>
            ) : (
              mesinLogs.map((log, idx) => (
                <div key={log.id} className={`p-5 md:p-6 flex flex-col gap-3 hover:bg-[#262626]/30 transition-colors ${idx !== mesinLogs.length -1 ? 'border-b border-[#262626]' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 rounded-lg uppercase font-black text-[9px] md:text-[10px] tracking-widest">{log.jenisTreatment}</span>
                      <span className="text-[9px] md:text-[10px] text-neutral-500 font-bold uppercase tracking-widest bg-[#0A0A0A] px-2 py-1 rounded-lg border border-[#262626] flex items-center gap-1.5"><Calendar className="w-3 h-3"/>{log.tanggalTreatment}</span>
                    </div>
                    <span className="text-[9px] text-neutral-600 font-mono">{log.id}</span>
                  </div>
                  <p className="text-sm md:text-base text-white font-medium leading-relaxed bg-[#0A0A0A] p-3 md:p-4 rounded-xl border border-[#262626]">{log.catatan}</p>
                  <p className="text-[9px] md:text-[10px] text-neutral-500 uppercase font-bold tracking-widest mt-1">Dicatat oleh <span className="text-yellow-400">{log.user}</span> pada {new Date(log.timestamp).toLocaleString('id-ID')}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {updateModalOpen && <StockActionModal item={updateItem} type={updateType} onClose={() => setUpdateModalOpen(false)} onSubmit={handleExecuteUpdate} />}

      {/* MODAL EDIT ITEM STOK */}
      {isModalOpen && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveItem} className="bg-[#171717] border border-[#262626] rounded-[32px] w-full max-w-sm p-6 shadow-2xl animate-modal relative">
            <button type="button" onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-[#0A0A0A] p-2 rounded-full"><Plus className="w-5 h-5 rotate-45"/></button>
            <h3 className="text-lg font-black uppercase tracking-tight mb-6 pr-8">{editingData.originalId ? 'Edit Kain' : 'Tambah Kain'}</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">ID Item</label><input type="text" value={editingData.id} onChange={e=>setEditingData({...editingData, id: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Nama Kain</label><input type="text" value={editingData.nama} onChange={e=>setEditingData({...editingData, nama: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Stok Awal</label><input type="number" step="0.1" value={editingData.stok} onChange={e=>setEditingData({...editingData, stok: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Satuan</label><select value={editingData.satuan} onChange={e=>setEditingData({...editingData, satuan: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none uppercase appearance-none"><option>Roll</option><option>Kg</option><option>Yard</option><option>Meter</option></select></div>
              </div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Cost Produksi (Rp)</label><input type="number" value={editingData.cost} onChange={e=>setEditingData({...editingData, cost: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
            </div>
            <button type="submit" className="w-full bg-yellow-400 text-black font-black py-4 rounded-2xl mt-8 text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-all">Simpan Data</button>
          </form>
        </div>
      )}

      {/* MODAL CATAT MESIN PRESS */}
      {mesinModalOpen && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveLogMesin} className="bg-[#171717] border border-[#262626] rounded-[32px] w-full max-w-md p-6 shadow-2xl animate-modal relative">
            <button type="button" onClick={() => setMesinModalOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-[#0A0A0A] p-2 rounded-full border border-[#262626]"><Plus className="w-5 h-5 rotate-45"/></button>
            <h3 className="text-lg font-black uppercase tracking-tight mb-6 pr-8">Catat Maintenance Press</h3>
            
            <div className="space-y-5">
              <div>
                <label className="text-[10px] text-neutral-400 font-bold mb-2 block uppercase tracking-widest">Jenis Treatment</label>
                <div className="flex flex-wrap gap-2">
                  {['service', 'checkup', 'ganti', 'lainnya'].map(opt => (
                    <button key={opt} type="button" onClick={() => setMesinForm({...mesinForm, jenisTreatment: opt})} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${mesinForm.jenisTreatment === opt ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-[#0A0A0A] border-[#262626] text-neutral-400 hover:text-white hover:border-neutral-500'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Tanggal Treatment</label><input type="date" value={mesinForm.tanggalTreatment} onChange={e=>setMesinForm({...mesinForm, tanggalTreatment: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none uppercase" required /></div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Catatan / Detail</label><textarea value={mesinForm.catatan} onChange={e=>setMesinForm({...mesinForm, catatan: e.target.value})} rows="3" className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none resize-none" placeholder="Cth: Ganti elemen pemanas..." required /></div>
            </div>
            <button type="submit" className="w-full bg-yellow-400 text-black font-black py-4 rounded-2xl mt-8 text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-all">Simpan Log Mesin</button>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODUL INVENTORI PRINT
// ==========================================
function ModulInventoriPrint({ currentUser, showToast }) {
  const [data, setData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [mesinLogs, setMesinLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [subTab, setSubTab] = useState('stok');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateItem, setUpdateItem] = useState(null);
  const [updateType, setUpdateType] = useState('IN');

  const [mesinModalOpen, setMesinModalOpen] = useState(false);
  const [mesinForm, setMesinForm] = useState({ jenisTreatment: 'service', catatan: '', tanggalTreatment: new Date().toISOString().split('T')[0] });

  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  const isAdmin = currentUser.role === 'admin';
  const canEditStock = isAdmin || (currentUser.role === 'produksi' && currentUser.posisi === 'Print');

  useEffect(() => {
    const unsubPrint = onSnapshot(collection(db, getColPath('inventori_print')), (snap) => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error fetching print:", err));
    return () => unsubPrint();
  }, []);

  const fetchLogs = useCallback(async (tab) => {
    setIsLoadingLogs(true);
    try {
      const logType = tab === 'log' ? 'print' : 'mesin_print';
      const snap = await getDocs(query(
        collection(db, getColPath('log_transaksi')),
        where('type', '==', logType)
      ));
      const allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp - a.timestamp);
      
      if (tab === 'log') setLogs(allLogs);
      else if (tab === 'log_mesin') setMesinLogs(allLogs);
    } catch { showToast("Gagal memuat log"); } finally { setIsLoadingLogs(false); }
  }, [showToast]);

  useEffect(() => {
    if (subTab === 'log' || subTab === 'log_mesin') fetchLogs(subTab);
  }, [fetchLogs, subTab]);

  const normalizedSearch = search.toLowerCase();
  const filteredData = useMemo(() => data.filter(d => d.nama.toLowerCase().includes(normalizedSearch) || d.id.toLowerCase().includes(normalizedSearch)), [data, normalizedSearch]);

  // Render Icon original dengan CSS styling klasik (C, M, Y, K)
  const getIcon = (type) => {
    switch(type) {
      case 'Cyan': return <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)] border-2 md:border-4 border-[#171717] flex items-center justify-center font-black text-black text-sm md:text-base">C</div>;
      case 'Magenta': return <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5)] border-2 md:border-4 border-[#171717] flex items-center justify-center font-black text-white text-sm md:text-base">M</div>;
      case 'Yellow': return <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] border-2 md:border-4 border-[#171717] flex items-center justify-center font-black text-black text-sm md:text-base">Y</div>;
      case 'Black': return <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#0A0A0A] shadow-[0_0_15px_rgba(0,0,0,0.8)] border-2 md:border-4 border-[#262626] flex items-center justify-center font-black text-white text-sm md:text-base">K</div>;
      case 'Cleaner': return <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/50 flex items-center justify-center font-black text-sm md:text-lg">CL</div>;
      case 'Paper': return <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-neutral-200 text-neutral-800 flex items-center justify-center text-lg md:text-xl">📜</div>;
      default: return <Package className="w-10 h-10 md:w-12 md:h-12 text-neutral-600" />;
    }
  };

  const openUpdateAction = (item, type) => {
    if(!canEditStock) return;
    setUpdateItem(item); setUpdateType(type); setUpdateModalOpen(true);
  };

  const handleExecuteUpdate = async (qty, actionType, catatan) => {
    const val = Number(qty);
    const itemRef = doc(db, getColPath('inventori_print'), updateItem.id);
    const logId = `LOGP-${Date.now()}`;
    const logRef = doc(db, getColPath('log_transaksi'), logId);

    try {
      await runTransaction(db, async (transaction) => {
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) throw new Error('Item tidak ditemukan');
        const currentStock = Number(itemSnap.data().stok || 0);
        const nextStock = actionType === 'IN' ? currentStock + val : currentStock - val;
        if (nextStock < 0) throw new Error('Stok tidak boleh minus');
        transaction.update(itemRef, { stok: nextStock });
        transaction.set(logRef, {
          id: logId, type: 'print', itemId: updateItem.id, itemNama: updateItem.nama,
          action: actionType, qty: val, catatan: catatan || '-', user: currentUser.nama, timestamp: Date.now()
        });
      });
      setUpdateModalOpen(false);
      const undoFn = async () => {
        await runTransaction(db, async (transaction) => {
          const logSnap = await transaction.get(logRef);
          if (!logSnap.exists()) return;
          const itemSnap = await transaction.get(itemRef);
          if (!itemSnap.exists()) throw new Error('Item tidak ditemukan');
          const currentStock = Number(itemSnap.data().stok || 0);
          const revertedStock = currentStock + (actionType === 'IN' ? -val : val);
          if (revertedStock < 0) throw new Error('Stok tidak boleh minus');
          transaction.update(itemRef, { stok: revertedStock });
          transaction.delete(logRef);
        });
        showToast("Undo sukses!");
      };
      showToast(`Stok ${updateItem.nama} diupdate.`, undoFn);
    } catch { showToast("Gagal update!"); }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const docId = editingData.originalId || generateID('P-');
    try {
      if (editingData.originalId && editingData.originalId !== editingData.id) await deleteDoc(doc(db, getColPath('inventori_print'), editingData.originalId));
      await setDoc(doc(db, getColPath('inventori_print'), editingData.id || docId), {
        id: editingData.id || docId, nama: editingData.nama, stok: Number(editingData.stok), satuan: editingData.satuan, logo: editingData.logo
      });
      setIsModalOpen(false); showToast("Item Print disimpan!");
    } catch { showToast("Gagal simpan data!"); }
  };

  const handleSaveLogMesin = async (e) => {
    e.preventDefault();
    const logId = `LOGMESINPRINT-${Date.now()}`;
    const payload = {
      id: logId, type: 'mesin_print', user: currentUser.nama, timestamp: Date.now(),
      tanggalInput: Date.now(), tanggalTreatment: mesinForm.tanggalTreatment,
      jenisTreatment: mesinForm.jenisTreatment, catatan: mesinForm.catatan
    };
    try {
      await setDoc(doc(db, getColPath('log_transaksi'), logId), payload);
      setMesinModalOpen(false); showToast("Log Mesin Printer tersimpan!"); fetchLogs('log_mesin');
    } catch { showToast("Gagal simpan log!"); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* PERFECT STICKY HEADER WRAPPER - Menyeluruh */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-xl pt-4 md:pt-8 px-4 md:px-8 pb-3 border-b border-[#262626] flex flex-col gap-4">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Inventori <span className="text-yellow-400">Print</span></h2>
            <p className="text-neutral-500 text-[10px] md:text-xs font-semibold mt-1">Tinta Sublim, Kertas, Cleaner.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input type="text" placeholder="Cari item..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full bg-[#171717] border border-[#262626] rounded-xl md:rounded-2xl pl-10 md:pl-11 pr-4 py-3.5 md:py-3 text-xs md:text-sm font-bold text-white focus:border-yellow-400 outline-none placeholder:text-neutral-600" />
            </div>
            {isAdmin && subTab === 'stok' && (
              <button onClick={() => { setEditingData({ id:generateID('P-'), originalId: null, nama:'', stok:0, satuan:'Liter', logo:'Cyan' }); setIsModalOpen(true); }} className="bg-yellow-400 text-black px-4 py-3.5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center font-black shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-transform shrink-0">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
            {canEditStock && subTab === 'log_mesin' && (
              <button onClick={() => { setMesinForm({jenisTreatment:'service', catatan:'', tanggalTreatment:new Date().toISOString().split('T')[0]}); setMesinModalOpen(true); }} className="bg-yellow-400 text-black px-4 py-3.5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-yellow-500 shrink-0 font-black shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-transform gap-2">
                <Plus className="w-4 h-4" /> Catat
              </button>
            )}
          </div>
        </div>

        {/* Tabs - Di dalam sticky wrapper */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button onClick={() => setSubTab('stok')} className={`whitespace-nowrap px-5 py-3 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border shrink-0 ${subTab === 'stok' ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-[#171717] text-neutral-500 border-[#262626] hover:bg-[#262626]'}`}>Stok Tinta & Kertas</button>
          <button onClick={() => setSubTab('log')} className={`whitespace-nowrap px-5 py-3 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border shrink-0 ${subTab === 'log' ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-[#171717] text-neutral-500 border-[#262626] hover:bg-[#262626]'}`}>Log Aktivitas</button>
          <button onClick={() => setSubTab('log_mesin')} className={`whitespace-nowrap px-5 py-3 md:py-2.5 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border shrink-0 flex items-center gap-1.5 ${subTab === 'log_mesin' ? 'bg-yellow-400 text-black border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-[#171717] text-neutral-500 border-[#262626] hover:bg-[#262626]'}`}><Printer className="w-3.5 h-3.5"/> Mesin Printer</button>
        </div>
      </div>

      {/* Main Content Scroll Area */}
      <div className="pt-4 px-4 md:px-8 pb-10">
        {subTab === 'stok' ? (
        // Grid khusus Mobile: pas 2 Kolom, kompak. Desktop lebih banyak.
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {filteredData.map(item => {
             const isOut = Number(item.stok) === 0;
             const isLow = Number(item.stok) === 1;
             return (
            <div key={item.id} className={`glass-card rounded-[20px] md:rounded-[24px] p-3.5 md:p-5 flex flex-col items-center text-center relative group transition-all ${isOut ? 'border-red-500/50 bg-red-950/10' : isLow ? 'border-orange-500/30' : ''}`}>
              
              <div className="absolute top-3.5 right-3.5 flex gap-1 z-10">
                {isOut ? <span className="bg-red-500 text-white text-[8px] md:text-[9px] px-2 py-0.5 md:px-2.5 md:py-1 rounded-md font-black uppercase tracking-widest animate-pulse">KOSONG</span> :
                 isLow ? <span className="bg-orange-500 text-black text-[8px] md:text-[9px] px-2 py-0.5 md:px-2.5 md:py-1 rounded-md font-black uppercase tracking-widest">MENIPIS</span> : null}

                {isAdmin && (
                  <button onClick={() => { setEditingData({ ...item, originalId: item.id }); setIsModalOpen(true); }} className="p-1.5 bg-[#0A0A0A] rounded-lg text-neutral-500 hover:text-yellow-400 transition-colors opacity-100 md:opacity-0 group-hover:opacity-100 border border-[#262626]">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              <p className="text-[9px] md:text-[10px] font-mono text-neutral-600 w-full text-left truncate">{item.id}</p>
              <div className="mb-3 md:mb-5 mt-1 relative flex justify-center">{getIcon(item.logo)}</div>
              <h3 className={`font-bold text-sm md:text-base line-clamp-2 leading-tight min-h-[2.5rem] w-full ${isOut ? 'text-red-400' : 'text-white'}`}>{item.nama}</h3>
              
              <div className="flex items-baseline gap-1 md:gap-1.5 my-2 md:my-3">
                <span className={`text-4xl md:text-5xl font-black tracking-tighter ${isOut ? 'text-red-500' : isLow ? 'text-orange-400' : 'text-yellow-400'}`}>{item.stok}</span>
                <span className="text-[9px] md:text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{item.satuan}</span>
              </div>

              {canEditStock && (
                <div className="flex w-full gap-2 mt-auto pt-3.5 md:pt-4 border-t border-[#262626]">
                  <button onClick={() => openUpdateAction(item, 'OUT')} className="flex-1 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 py-2.5 rounded-xl transition-colors active:scale-95 flex justify-center font-black"><Minus className="w-4 h-4 md:w-5 md:h-5"/></button>
                  <button onClick={() => openUpdateAction(item, 'IN')} className="flex-1 bg-green-500/10 hover:bg-green-500 hover:text-white text-green-500 py-2.5 rounded-xl transition-colors active:scale-95 flex justify-center font-black"><Plus className="w-4 h-4 md:w-5 md:h-5"/></button>
                </div>
              )}
            </div>
          )})}
        </div>
        ) : subTab === 'log' ? (
          <div className="glass-card rounded-xl md:rounded-[24px] overflow-hidden">
            {isLoadingLogs ? (
              <div className="p-8 text-center text-yellow-400 text-xs font-bold uppercase tracking-widest animate-pulse">Menarik data log stok...</div>
            ) : logs.length === 0 ? (
               <div className="p-8 text-center text-neutral-500 font-bold uppercase tracking-widest text-xs">Belum ada log aktivitas.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={log.id} className={`p-4 md:p-5 flex justify-between items-center gap-3 hover:bg-[#262626]/30 transition-colors ${idx !== logs.length -1 ? 'border-b border-[#262626]' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] md:text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">{new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <h4 className="font-bold text-white text-sm md:text-base leading-tight truncate pr-2 mb-1">{log.itemNama}</h4>
                    {log.catatan && log.catatan !== '-' && (
                      <p className="text-[10px] md:text-xs text-neutral-400 italic flex items-center gap-1.5 mt-1.5"><MessageSquare className="w-3 h-3"/> {log.catatan}</p>
                    )}
                    <p className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest mt-2">Oleh: <span className="text-yellow-400">{log.user}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xl md:text-2xl font-black ${log.action === 'IN' ? 'text-green-500' : 'text-red-500'}`}>{log.action === 'IN' ? '+' : '-'}{log.qty}</span>
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${log.action === 'IN' ? 'text-green-500/70' : 'text-red-500/70'}`}>{log.action === 'IN' ? 'MASUK' : 'KELUAR'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="glass-card rounded-xl md:rounded-[24px] overflow-hidden">
            {isLoadingLogs ? (
              <div className="p-8 text-center text-yellow-400 text-xs font-bold uppercase tracking-widest animate-pulse">Menarik log mesin...</div>
            ) : mesinLogs.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 font-bold uppercase tracking-widest text-xs">Belum ada catatan maintenance printer.</div>
            ) : (
              mesinLogs.map((log, idx) => (
                <div key={log.id} className={`p-5 md:p-6 flex flex-col gap-3 hover:bg-[#262626]/30 transition-colors ${idx !== mesinLogs.length -1 ? 'border-b border-[#262626]' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg uppercase font-black text-[9px] md:text-[10px] tracking-widest">{log.jenisTreatment}</span>
                      <span className="text-[9px] md:text-[10px] text-neutral-500 font-bold uppercase tracking-widest bg-[#0A0A0A] px-2 py-1 rounded-lg border border-[#262626] flex items-center gap-1.5"><Calendar className="w-3 h-3"/>{log.tanggalTreatment}</span>
                    </div>
                    <span className="text-[9px] text-neutral-600 font-mono">{log.id}</span>
                  </div>
                  <p className="text-sm md:text-base text-white font-medium leading-relaxed bg-[#0A0A0A] p-3 md:p-4 rounded-xl border border-[#262626]">{log.catatan}</p>
                  <p className="text-[9px] md:text-[10px] text-neutral-500 uppercase font-bold tracking-widest mt-1">Dicatat oleh <span className="text-yellow-400">{log.user}</span> pada {new Date(log.timestamp).toLocaleString('id-ID')}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {updateModalOpen && <StockActionModal item={updateItem} type={updateType} onClose={() => setUpdateModalOpen(false)} onSubmit={handleExecuteUpdate} />}

      {/* MODAL EDIT ITEM STOK */}
      {isModalOpen && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveItem} className="bg-[#171717] border border-[#262626] rounded-[32px] w-full max-w-sm p-6 shadow-2xl animate-modal relative">
            <button type="button" onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-[#0A0A0A] p-2 rounded-full"><Plus className="w-5 h-5 rotate-45"/></button>
            <h3 className="text-lg font-black uppercase tracking-tight mb-6 pr-8">{editingData.originalId ? 'Edit Item' : 'Item Print Baru'}</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">ID Item / Kode</label><input type="text" value={editingData.id} onChange={e=>setEditingData({...editingData, id: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Nama Item</label><input type="text" value={editingData.nama} onChange={e=>setEditingData({...editingData, nama: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Stok Awal</label><input type="number" step="0.1" value={editingData.stok} onChange={e=>setEditingData({...editingData, stok: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Satuan</label><input type="text" value={editingData.satuan} onChange={e=>setEditingData({...editingData, satuan: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
              </div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Warna / Tipe</label><select value={editingData.logo} onChange={e=>setEditingData({...editingData, logo: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none uppercase appearance-none"><option>Cyan</option><option>Magenta</option><option>Yellow</option><option>Black</option><option>Cleaner</option><option>Paper</option></select></div>
            </div>
            <button type="submit" className="w-full bg-yellow-400 text-black font-black py-4 rounded-2xl mt-8 text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-all">Simpan</button>
          </form>
        </div>
      )}

      {/* MODAL CATAT MESIN PRINTER */}
      {mesinModalOpen && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveLogMesin} className="bg-[#171717] border border-[#262626] rounded-[32px] w-full max-w-md p-6 shadow-2xl animate-modal relative">
            <button type="button" onClick={() => setMesinModalOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-[#0A0A0A] p-2 rounded-full border border-[#262626]"><Plus className="w-5 h-5 rotate-45"/></button>
            <h3 className="text-lg font-black uppercase tracking-tight mb-6 pr-8">Catat Maintenance Printer</h3>
            
            <div className="space-y-5">
              <div>
                <label className="text-[10px] text-neutral-400 font-bold mb-2 block uppercase tracking-widest">Jenis Treatment</label>
                <div className="flex flex-wrap gap-2">
                  {['service', 'checkup', 'ganti head', 'lainnya'].map(opt => (
                    <button key={opt} type="button" onClick={() => setMesinForm({...mesinForm, jenisTreatment: opt})} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${mesinForm.jenisTreatment === opt ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-[#0A0A0A] border-[#262626] text-neutral-400 hover:text-white hover:border-neutral-500'}`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Tanggal Treatment</label><input type="date" value={mesinForm.tanggalTreatment} onChange={e=>setMesinForm({...mesinForm, tanggalTreatment: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none uppercase" required /></div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Catatan / Detail</label><textarea value={mesinForm.catatan} onChange={e=>setMesinForm({...mesinForm, catatan: e.target.value})} rows="3" className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none resize-none" placeholder="Cth: Clean printhead warna kuning..." required /></div>
            </div>
            <button type="submit" className="w-full bg-yellow-400 text-black font-black py-4 rounded-2xl mt-8 text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-all">Simpan Log Mesin</button>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODUL KATALOG PRODUK
// ==========================================
function ModulKatalog({ currentUser, showToast }) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subTab, setSubTab] = useState('model'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);

  const isAdmin = currentUser.role === 'admin';

  const config = useMemo(() => ({
    model: { title: 'Model Pesanan', collection: 'katalog_model_pesanan', prefix: 'MDL-' },
    jahitAtasan: { title: 'Jahit Atasan', collection: 'katalog_varian_jahit_atasan', prefix: 'VJA-' },
    lenganAtasan: { title: 'Lengan Atasan', collection: 'katalog_varian_lengan_atasan', prefix: 'VLA-' },
    jahitBawahan: { title: 'Jahit Bawahan', collection: 'katalog_varian_jahit_bawahan', prefix: 'VJB-' },
  }), []);

  const fetchKatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const colName = config[subTab].collection;
      const snap = await getDocs(collection(db, getColPath(colName)));
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { showToast("Gagal memuat katalog"); } finally { setIsLoading(false); }
  }, [config, showToast, subTab]);

  useEffect(() => { fetchKatalog(); }, [fetchKatalog]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const docId = editingData.id || generateID(config[subTab].prefix);
    const colName = getColPath(config[subTab].collection);
    const payload = { id: docId, nama: editingData.nama, cost: Number(editingData.cost || 0) };
    if (subTab === 'model') { payload.kategori = editingData.kategori || 'Atasan'; payload.kategoriFilter = editingData.kategoriFilter || 'Standard'; } 
    else if (subTab === 'jahitAtasan' || subTab === 'jahitBawahan') { payload.kategoriFilter = editingData.kategoriFilter || 'Standard'; }

    try {
      if (editingData.originalId && editingData.originalId !== docId) await deleteDoc(doc(db, colName, editingData.originalId));
      await setDoc(doc(db, colName, docId), payload);
      setIsModalOpen(false); showToast("Katalog disimpan!"); fetchKatalog(); 
    } catch { showToast("Gagal simpan data"); }
  };

  const handleDelete = async (id) => {
    if(!isAdmin) return;
    if(confirm("Hapus item katalog ini?")) { await deleteDoc(doc(db, getColPath(config[subTab].collection), id)); fetchKatalog(); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Wrapper */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A] pt-4 md:pt-8 px-4 md:px-8 pb-4 border-b border-[#262626]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Katalog <span className="text-yellow-400">Master</span></h2>
            <p className="text-neutral-500 text-[10px] md:text-xs font-semibold mt-1">Database base harga dan tipe jahitan.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={fetchKatalog} className="p-3.5 md:p-3 bg-[#171717] border border-[#262626] rounded-xl md:rounded-2xl hover:bg-[#262626] transition-colors shrink-0">
               <RefreshCw className={`w-4 h-4 text-neutral-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && (
              <button onClick={() => { setEditingData({id: generateID(config[subTab].prefix), originalId: null, nama:'', cost:0, kategori:'Atasan', kategoriFilter:'Standard'}); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-yellow-400 text-black px-4 md:px-5 py-3.5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 font-black shadow-[0_0_15px_rgba(250,204,21,0.2)] text-[10px] md:text-xs uppercase tracking-widest shrink-0 active:scale-95 transition-transform">
                <Plus className="w-4 h-4" /> Tambah Item
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {Object.keys(config).map(k => (
            <button key={k} onClick={() => setSubTab(k)} className={`whitespace-nowrap px-4 md:px-6 py-2.5 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border ${subTab === k ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-[#171717] text-neutral-500 border-[#262626] hover:bg-[#262626]'}`}>
              {config[k].title}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 px-4 md:px-8 pb-10">
        <div className="glass-card rounded-xl md:rounded-[24px] overflow-hidden min-h-[250px] mb-4">
          {isLoading ? (
             <div className="p-8 text-center text-yellow-400 text-[10px] md:text-xs font-bold uppercase tracking-widest animate-pulse">Memuat katalog...</div>
          ) : data.length === 0 ? (
             <div className="p-8 text-center text-neutral-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">Data kosong / belum ada.</div>
          ) : (
            data.map((item, idx) => (
              <div key={item.id} className={`p-4 md:p-6 flex flex-col md:flex-row md:justify-between md:items-center gap-3 hover:bg-[#262626]/30 transition-colors ${idx !== data.length -1 ? 'border-b border-[#262626]' : ''}`}>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-white text-base md:text-lg leading-tight mb-2.5 truncate">{item.nama}</h4>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[9px] text-neutral-500 font-black tracking-widest bg-[#0A0A0A] px-2 py-1 rounded-md border border-[#262626]">{item.id}</span>
                    {item.kategori && <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1 rounded font-bold uppercase tracking-widest">{item.kategori}</span>}
                    {item.kategoriFilter && <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-1 rounded font-bold uppercase tracking-widest">Kunci: {item.kategoriFilter}</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 mt-2 md:mt-0 pt-3 md:pt-0 border-t border-[#262626] md:border-0 shrink-0">
                  <span className="font-black text-yellow-400 text-lg md:text-xl">{formatRp(item.cost)}</span>
                  {isAdmin && (
                    <div className="flex gap-1.5 md:gap-2 md:border-l border-[#262626] md:pl-5 shrink-0">
                      <button onClick={() => { setEditingData({ ...item, originalId: item.id }); setIsModalOpen(true); }} className="p-2 md:p-2.5 text-neutral-400 hover:text-yellow-400 bg-[#0A0A0A] border border-[#262626] rounded-lg md:rounded-xl transition-colors"><Edit2 className="w-3.5 h-3.5 md:w-4 h-4"/></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 md:p-2.5 text-red-500 hover:text-white bg-red-500/10 border border-red-500/20 rounded-lg md:rounded-xl transition-colors"><Trash2 className="w-3.5 h-3.5 md:w-4 h-4"/></button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSave} className="bg-[#171717] border border-[#262626] rounded-[32px] w-full max-w-sm p-6 shadow-2xl animate-modal relative">
            <button type="button" onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-[#0A0A0A] p-2 rounded-full border border-[#262626]"><Plus className="w-5 h-5 rotate-45"/></button>
            <h3 className="text-lg font-black uppercase tracking-tight mb-6 pr-8">{editingData.originalId ? 'Edit' : 'Tambah'} {config[subTab].title}</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">ID Item / Kode</label><input type="text" value={editingData.id} onChange={e=>setEditingData({...editingData, id: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
              <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Nama Item</label><input type="text" value={editingData.nama} onChange={e=>setEditingData({...editingData, nama: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
              {subTab === 'model' && (
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Kategori Pakaian</label><select value={editingData.kategori} onChange={e=>setEditingData({...editingData, kategori: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none uppercase appearance-none"><option>Atasan</option><option>Bawahan</option></select></div>
              )}
              {(subTab === 'model' || subTab === 'jahitAtasan' || subTab === 'jahitBawahan') && (
                <div><label className="text-[10px] text-neutral-400 font-bold mb-1.5 block uppercase tracking-widest">Kategori Varian (Key Filter)</label><input type="text" value={editingData.kategoriFilter || ''} onChange={e=>setEditingData({...editingData, kategoriFilter: e.target.value})} placeholder="ex: Standard, Raglan..." className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" /></div>
              )}
              <div><label className="text-[10px] text-[#a3a3a3] font-bold mb-1.5 block uppercase tracking-widest">Cost Modal (Rp)</label><input type="number" value={editingData.cost} onChange={e=>setEditingData({...editingData, cost: e.target.value})} className="w-full bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 text-sm font-semibold text-white focus:border-yellow-400 outline-none" required /></div>
            </div>
            <button type="submit" className="w-full bg-yellow-400 text-black font-black py-4 rounded-2xl mt-8 text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.2)] active:scale-95 transition-all">Simpan Katalog</button>
          </form>
        </div>
      )}
    </div>
  );
}
