// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, doc, getDocs, getDoc, 
  runTransaction, updateDoc, serverTimestamp, query, orderBy, limit
} from 'firebase/firestore';
import { 
  Truck, User, Search, MapPin, Phone, CheckCircle, Map, 
  FileText, Package, Scale, ChevronRight, X, Send, Navigation,
  CalendarClock, Copy
} from 'lucide-react';

// ==========================================
// 1. KONFIGURASI FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBDyw6abBksq1UhduuoH-XJ8YCq-GkWFv8",
  authDomain: "mandiri-clothing-webapp.firebaseapp.com",
  projectId: "mandiri-clothing-webapp",
  storageBucket: "mandiri-clothing-webapp.firebasestorage.app",
  messagingSenderId: "360243309180",
  appId: "1:360243309180:web:e35580c34c1182422037f9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 2. KOMPONEN UTAMA
// ==========================================

// Helper function: Radar pembaca multi-versi field nama di Firestore
const getCustName = (c) => c?.nama_customer || c?.namaCustomer || c?.nama || c?.customerName || c?.nama_pemesan || 'Tanpa Nama';
const getCustPhone = (c) => c?.nomor_hp || c?.nomorHp || c?.hp || c?.phone || c?.no_hp || '-';
const getSpkTitle = (s) => s?.judul || s?.judulPesanan || s?.namaPesanan || s?.nama_pesanan || s?.tipePesanan || 'Tanpa Judul';

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);
  
  // State: Routing (Admin vs Customer View)
  const [viewMode, setViewMode] = useState('admin'); // 'admin' | 'customer'
  const [shippingIdFromUrl, setShippingIdFromUrl] = useState(null);

  // State: Admin Form
  const [customers, setCustomers] = useState([]);
  const [spks, setSpks] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  const [selectedSpks, setSelectedSpks] = useState([]);
  const [showSpkModal, setShowSpkModal] = useState(false);
  const [berat, setBerat] = useState('');
  const [koli, setKoli] = useState('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  
  // State: Customer Form
  const [customerForm, setCustomerForm] = useState({
    namaPenerima: '',
    hpPenerima: '',
    alamatLengkap: '',
    mapsLink: ''
  });
  const [shippingDataTarget, setShippingDataTarget] = useState(null);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [isCustomerSuccess, setIsCustomerSuccess] = useState(false);

  // Styling Urbanist Font injection
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    document.body.style.fontFamily = "'Urbanist', sans-serif";
    document.body.className = "bg-zinc-950 text-zinc-100 min-h-screen selection:bg-yellow-400 selection:text-zinc-900";
  }, []);

  // Inisialisasi Auth & Routing
  useEffect(() => {
    const init = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    init();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Cek URL params untuk menentukan mode
        const urlParams = new URLSearchParams(window.location.search);
        const idParam = urlParams.get('id');
        
        if (idParam) {
          setViewMode('customer');
          setShippingIdFromUrl(idParam);
          await fetchShippingData(idParam);
        } else {
          setViewMode('admin');
          fetchAdminData();
        }
      }
      setLoadingApp(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Data untuk Admin
  const fetchAdminData = async () => {
    try {
      // Dummy data fallback untuk testing jika firestore kosong
      let dummyCustomers = [
        { id: "CU579221AZI", nama_customer: "Budi Santoso", nomor_hp: "081234567890" },
        { id: "CU881234XTY", nama_customer: "Ahmad Jersey", nomor_hp: "081999888777" }
      ];
      let dummySpks = [
        { id: "0095PO-MCD#002529", judul: "Jersey Futsal Budi", createdAt: { toDate: () => new Date() } },
        { id: "0096PO-MCD#002530", judul: "Polo Shirt Panitia", createdAt: { toDate: () => new Date() } }
      ];

      // Fetch Real Customers
      const custSnapshot = await getDocs(collection(db, 'data_customers'));
      if (!custSnapshot.empty) {
        const custList = custSnapshot.docs.map(doc => {
          console.log("CEK STRUKTUR CUSTOMER DARI DB:", doc.data()); // Log Debugging
          return { id: doc.id, ...doc.data() };
        });
        setCustomers(custList);
      } else { setCustomers(dummyCustomers); }

      // Fetch Real SPK (Ambil 20 SPK terbaru)
      const spkQuery = query(collection(db, 'spk_produksi'), limit(20)); // Tambahkan orderBy createdAt desc di prod
      const spkSnapshot = await getDocs(spkQuery);
      if (!spkSnapshot.empty) {
        const spkList = spkSnapshot.docs.map(doc => {
          console.log("CEK STRUKTUR SPK DARI DB:", doc.data()); // Log Debugging
          return { id: doc.id, ...doc.data() };
        });
        setSpks(spkList);
      } else { setSpks(dummySpks); }

    } catch (error) {
      console.error("Error fetching admin data:", error);
    }
  };

  // Fetch Data untuk Customer View
  const fetchShippingData = async (id) => {
    try {
      const docRef = doc(db, 'data_alamat_kirim', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setShippingDataTarget(docSnap.data());
        // Pre-fill jika sudah pernah diisi
        setCustomerForm({
          namaPenerima: docSnap.data().customerData?.namaPenerima || '',
          hpPenerima: docSnap.data().customerData?.hpPenerima || '',
          alamatLengkap: docSnap.data().customerData?.alamatLengkap || '',
          mapsLink: docSnap.data().customerData?.mapsLink || ''
        });
      }
    } catch (error) {
      console.error("Error fetching shipping target:", error);
    }
  };

  // ==========================================
  // HANDLERS: ADMIN
  // ==========================================
  const toggleSpkSelection = (spk) => {
    if (selectedSpks.find(s => s.id === spk.id)) {
      setSelectedSpks(selectedSpks.filter(s => s.id !== spk.id));
    } else {
      setSelectedSpks([...selectedSpks, spk]);
    }
  };

  const handleAdminSubmit = async () => {
    if (!selectedCustomer || selectedSpks.length === 0 || !berat || !koli) {
      alert("Mohon lengkapi semua data (Customer, SPK, Berat, dan Koli)!");
      return;
    }

    setIsSubmittingAdmin(true);
    try {
      const counterRef = doc(db, 'metadata', 'shipping_counter');
      
      const newShippingId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentCount = 0;
        
        if (counterDoc.exists() && counterDoc.data().count) {
          currentCount = counterDoc.data().count;
        }
        
        const nextCount = currentCount + 1;
        const paddedCount = String(nextCount).padStart(4, '0');
        
        // Format: [SHP][nomor urut count][customerID]
        const cleanCustomerId = selectedCustomer.id.replace(/\s+/g, '');
        const generatedId = `SHP${paddedCount}${cleanCustomerId}`;
        
        // Tulis counter baru
        transaction.set(counterRef, { count: nextCount }, { merge: true });
        
        // Tulis dokumen form
        const shippingDocRef = doc(db, 'data_alamat_kirim', generatedId);
        transaction.set(shippingDocRef, {
          adminData: {
            customerId: selectedCustomer.id,
            customerName: getCustName(selectedCustomer),
            customerHp: getCustPhone(selectedCustomer),
            spkIds: selectedSpks.map(s => s.id),
            spkDetails: selectedSpks.map(s => ({ id: s.id, judul: getSpkTitle(s) })),
            beratKiriman: parseFloat(berat),
            jumlahKoli: parseInt(koli),
            createdByAdminAt: serverTimestamp(),
          },
          status: 'Menunggu Form Customer',
          customerData: null // Akan diisi customer
        });

        return generatedId;
      });

      // Generate Link
      const baseUrl = window.location.origin + window.location.pathname;
      const link = `${baseUrl}?id=${newShippingId}`;
      setGeneratedLink(link);
      
    } catch (error) {
      console.error("Transaction failed: ", error);
      alert("Terjadi kesalahan saat membuat form pengiriman.");
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  const formatToWaLink = (phone, link) => {
    if (!phone) return '#';
    let formattedPhone = phone.replace(/\D/g, ''); // Hapus karakter non-digit
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }
    
    const message = `Halo Kak, pesanan Mandiri Clothing Kakak sudah siap dikirim! 🚀\n\nMohon bantuannya untuk mengisi *Form Alamat Pengiriman* pada link aman berikut ini agar paket bisa segera kami proses:\n\n🔗 ${link}\n\nTerima kasih! ✨`;
    
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  // ==========================================
  // HANDLERS: CUSTOMER
  // ==========================================
  const formatPhoneNumber = (val) => {
    // Format to: 0812 3456 7890
    let cleaned = ('' + val).replace(/\D/g, '');
    let match = cleaned.match(/^(\d{0,4})(\d{0,4})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `${match[1]} ${match[2]}${match[3] ? ` ${match[3]}` : ''}`;
    }
    return val;
  };

  const getGPSLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
          setCustomerForm({ ...customerForm, mapsLink });
        },
        (error) => {
          alert("Gagal mendapatkan lokasi. Pastikan izin GPS diberikan, atau paste link Google Maps secara manual.");
        }
      );
    } else {
      alert("Browser Anda tidak mendukung fitur Geolocation.");
    }
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!customerForm.namaPenerima || !customerForm.hpPenerima || !customerForm.alamatLengkap) {
      alert("Nama, Nomor HP, dan Alamat Lengkap wajib diisi!");
      return;
    }

    setIsSubmittingCustomer(true);
    try {
      const docRef = doc(db, 'data_alamat_kirim', shippingIdFromUrl);
      await updateDoc(docRef, {
        customerData: {
          ...customerForm,
          filledAt: serverTimestamp()
        },
        status: 'Siap Kirim'
      });
      setIsCustomerSuccess(true);
    } catch (error) {
      console.error("Error saving customer data:", error);
      alert("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  // ==========================================
  // RENDER UI
  // ==========================================
  if (loadingApp) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-zinc-950 sm:border-x sm:border-zinc-800 relative shadow-2xl overflow-x-hidden">
      
      {/* HEADER GLOBAL */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-400/20">
            <Truck className="text-zinc-900 w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">Shipping System</h1>
            <p className="text-xs text-yellow-400 font-medium">Mandiri Clothing Enterprise</p>
          </div>
        </div>
      </div>

      <div className="p-4 pb-24">
        {/* ========================================== */}
        {/* VIEW ADMIN */}
        {/* ========================================== */}
        {viewMode === 'admin' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-yellow-400" /> 1. Identitas Customer
              </h2>
              
              {/* Customer Auto-complete Selector */}
              <div className="relative">
                {selectedCustomer ? (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white text-lg">{getCustName(selectedCustomer)}</p>
                      <p className="text-xs text-yellow-400 font-mono mt-1">{selectedCustomer.id}</p>
                      <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {getCustPhone(selectedCustomer)}
                      </p>
                    </div>
                    <button 
                      onClick={() => setSelectedCustomer(null)}
                      className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-zinc-500" />
                      </div>
                      <input
                        type="text"
                        placeholder="Cari ID atau Nama Customer..."
                        className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-white outline-none transition"
                        value={searchCustomer}
                        onChange={(e) => {
                          setSearchCustomer(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                      />
                    </div>
                    
                    {showCustomerDropdown && searchCustomer && (
                      <div className="absolute z-10 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                        {customers.filter(c => 
                          getCustName(c).toLowerCase().includes(searchCustomer.toLowerCase()) || 
                          (c.id || '').toLowerCase().includes(searchCustomer.toLowerCase())
                        ).map((cust) => (
                          <div 
                            key={cust.id}
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setShowCustomerDropdown(false);
                              setSearchCustomer('');
                            }}
                            className="p-3 border-b border-zinc-700/50 hover:bg-zinc-700 cursor-pointer transition flex justify-between items-center"
                          >
                            <div>
                              <p className="font-semibold text-white text-sm">{getCustName(cust)}</p>
                              <p className="text-xs text-yellow-400 font-mono">{cust.id}</p>
                            </div>
                            <span className="text-xs text-zinc-400">{getCustPhone(cust)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-yellow-400" /> 2. Data SPK (File Explorer)
              </h2>
              
              <button 
                onClick={() => setShowSpkModal(true)}
                className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 border-dashed rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Search className="w-5 h-5 text-zinc-400" />
                <span className="text-zinc-300 font-medium">Cari & Pilih SPK</span>
              </button>

              {/* Selected SPKs List */}
              {selectedSpks.length > 0 && (
                <div className="mt-4 space-y-2">
                  {selectedSpks.map(spk => (
                    <div key={spk.id} className="bg-zinc-800 border border-yellow-400/30 rounded-lg p-3 flex justify-between items-center">
                      <div className="truncate pr-4">
                        <p className="text-yellow-400 font-mono text-xs mb-1">{spk.id}</p>
                        <p className="text-sm font-semibold text-white truncate">{getSpkTitle(spk)}</p>
                      </div>
                      <button 
                        onClick={() => toggleSpkSelection(spk)}
                        className="text-zinc-500 hover:text-red-400 flex-shrink-0"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 grid grid-cols-2 gap-4">
               <div className="col-span-2">
                 <h2 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-yellow-400" /> 3. Detail Pengiriman
                 </h2>
               </div>
               
               <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Berat (Kg)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={berat}
                      onChange={(e) => setBerat(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 pl-4 pr-10 text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                      placeholder="0.0"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-zinc-500 font-bold">KG</span>
                  </div>
               </div>
               <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Jumlah Koli</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={koli}
                      onChange={(e) => setKoli(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 pl-4 pr-10 text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-zinc-500 font-bold">KOLI</span>
                  </div>
               </div>
            </div>

            {/* GENERATE LINK ACTION */}
            {!generatedLink ? (
              <button
                onClick={handleAdminSubmit}
                disabled={isSubmittingAdmin || !selectedCustomer || selectedSpks.length === 0 || !berat || !koli}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-zinc-900 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmittingAdmin ? (
                   <span className="animate-pulse">Membuat Form...</span>
                ) : (
                  <>Generate Link Pengiriman <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
            ) : (
              <div className="bg-yellow-400/10 border border-yellow-400 rounded-2xl p-5 text-center animate-fade-in">
                <CheckCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <h3 className="font-bold text-white mb-1">Link Form Berhasil Dibuat!</h3>
                <p className="text-xs text-zinc-400 mb-4 truncate">{generatedLink}</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      alert("Link disalin ke clipboard!");
                    }}
                    className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center justify-center gap-2 font-medium transition"
                  >
                    <Copy className="w-4 h-4" /> Salin Link
                  </button>
                  <a 
                    href={formatToWaLink(selectedCustomer?.nomor_hp, generatedLink)}
                    target="_blank" rel="noreferrer"
                    className="py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold transition shadow-lg shadow-green-500/20"
                  >
                    <Send className="w-4 h-4" /> Kirim via WA
                  </a>
                </div>
                
                <button 
                  onClick={() => {
                    setGeneratedLink('');
                    setSelectedCustomer(null);
                    setSelectedSpks([]);
                    setBerat('');
                    setKoli('');
                  }}
                  className="mt-4 text-sm text-yellow-400 hover:underline"
                >
                  Buat Pengiriman Baru
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* VIEW CUSTOMER */}
        {/* ========================================== */}
        {viewMode === 'customer' && shippingDataTarget && (
          <div className="space-y-6 animate-fade-in">
            
            {isCustomerSuccess ? (
               <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center shadow-xl mt-10">
                 <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                   <CheckCircle className="w-10 h-10 text-green-500" />
                 </div>
                 <h2 className="text-2xl font-bold text-white mb-2">Terima Kasih!</h2>
                 <p className="text-zinc-400 mb-6">Data alamat pengiriman Anda telah berhasil disimpan dan pesanan siap untuk diproses kirim.</p>
                 <div className="p-4 bg-zinc-800 rounded-xl">
                   <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">ID Pengiriman</p>
                   <p className="font-mono text-yellow-400 font-bold">{shippingIdFromUrl}</p>
                 </div>
               </div>
            ) : (
              <>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
                  <h2 className="text-lg font-bold text-white mb-1">Lengkapi Alamat Pengiriman</h2>
                  <p className="text-sm text-zinc-400 mb-4">Mohon isi data di bawah ini dengan lengkap dan benar agar paket sampai tujuan.</p>
                  
                  {/* Read-only info box */}
                  <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden mb-6">
                    <div className="flex-1 p-3 border-r border-zinc-800 text-center">
                      <p className="text-xs text-zinc-500 mb-1">Berat</p>
                      <p className="font-bold text-white text-lg">{shippingDataTarget.adminData?.beratKiriman} <span className="text-sm text-zinc-400">kg</span></p>
                    </div>
                    <div className="flex-1 p-3 text-center">
                      <p className="text-xs text-zinc-500 mb-1">Jumlah</p>
                      <p className="font-bold text-white text-lg">{shippingDataTarget.adminData?.jumlahKoli} <span className="text-sm text-zinc-400">koli</span></p>
                    </div>
                  </div>

                  <form onSubmit={handleCustomerSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm text-zinc-300 font-medium mb-1.5 block">Nama Penerima <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-zinc-500" />
                        </div>
                        <input 
                          type="text" required
                          value={customerForm.namaPenerima}
                          onChange={(e) => setCustomerForm({...customerForm, namaPenerima: e.target.value})}
                          className="w-full pl-10 pr-4 py-3.5 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-yellow-400 text-white outline-none"
                          placeholder="Contoh: Budi Santoso"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-300 font-medium mb-1.5 block">Nomor HP Aktif (WA) <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-zinc-500" />
                        </div>
                        <input 
                          type="tel" required
                          value={customerForm.hpPenerima}
                          onChange={(e) => {
                            const formatted = formatPhoneNumber(e.target.value);
                            setCustomerForm({...customerForm, hpPenerima: formatted});
                          }}
                          className="w-full pl-10 pr-4 py-3.5 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-yellow-400 text-white outline-none"
                          placeholder="0812 3456 7890"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-300 font-medium mb-1.5 block">Alamat Lengkap <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <div className="absolute top-3 left-3 pointer-events-none">
                          <MapPin className="h-5 w-5 text-zinc-500" />
                        </div>
                        <textarea 
                          required rows="3"
                          value={customerForm.alamatLengkap}
                          onChange={(e) => setCustomerForm({...customerForm, alamatLengkap: e.target.value})}
                          className="w-full pl-10 pr-4 py-3.5 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-yellow-400 text-white outline-none resize-none"
                          placeholder="Nama Jalan, RT/RW, Patokan, Desa/Kelurahan, Kecamatan, Kota, Kode Pos"
                        ></textarea>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-300 font-medium mb-1.5 flex justify-between">
                        <span>Tandai Peta (Opsional)</span>
                      </label>
                      
                      <button 
                        type="button"
                        onClick={getGPSLocation}
                        className="w-full mb-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-yellow-400/30 text-yellow-400 rounded-xl flex items-center justify-center gap-2 font-medium transition"
                      >
                        <Navigation className="w-4 h-4" /> Dapatkan Lokasi Saat Ini (GPS)
                      </button>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Map className="h-5 w-5 text-zinc-500" />
                        </div>
                        <input 
                          type="url"
                          value={customerForm.mapsLink}
                          onChange={(e) => setCustomerForm({...customerForm, mapsLink: e.target.value})}
                          className="w-full pl-10 pr-4 py-3.5 bg-zinc-800 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-yellow-400 text-white outline-none text-sm"
                          placeholder="Atau Paste Link Google Maps disini"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingCustomer}
                      className="w-full mt-6 py-4 bg-yellow-400 hover:bg-yellow-500 text-zinc-900 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20 disabled:opacity-50 transition"
                    >
                      {isSubmittingCustomer ? 'Menyimpan...' : 'Simpan Alamat Pengiriman'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* ========================================== */}
      {/* MODAL: FILE EXPLORER SPK */}
      {/* ========================================== */}
      {showSpkModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="bg-zinc-900 w-full max-w-md h-[80vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl border border-zinc-800 flex flex-col shadow-2xl overflow-hidden animate-slide-up sm:animate-none">
            
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-yellow-400"/> Pilih SPK
              </h3>
              <button onClick={() => setShowSpkModal(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-zinc-950/50">
              {spks.map(spk => {
                const isSelected = selectedSpks.find(s => s.id === spk.id);
                // Format Date fallback
                let dateStr = 'Unknown Date';
                if (spk.createdAt && spk.createdAt.toDate) {
                  dateStr = spk.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                }
                
                return (
                  <div 
                    key={spk.id}
                    onClick={() => toggleSpkSelection(spk)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex justify-between items-center ${
                      isSelected 
                        ? 'bg-yellow-400/10 border-yellow-400' 
                        : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    <div>
                      <p className={`font-mono text-xs mb-1 ${isSelected ? 'text-yellow-400' : 'text-zinc-400'}`}>
                        {spk.id}
                      </p>
                      <p className="font-bold text-white mb-2">{getSpkTitle(spk)}</p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> {dateStr}
                      </p>
                    </div>
                    
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-yellow-400 bg-yellow-400' : 'border-zinc-500'
                    }`}>
                      {isSelected && <CheckCircle className="w-4 h-4 text-zinc-900" />}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
              <button 
                onClick={() => setShowSpkModal(false)}
                className="w-full py-3 bg-yellow-400 text-zinc-900 font-bold rounded-xl"
              >
                Selesai Pilih ({selectedSpks.length})
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Global Styles for Animations & Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}} />

    </div>
  );
}
