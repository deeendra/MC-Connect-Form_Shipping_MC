// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, 
  runTransaction, updateDoc, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { 
  Package, MapPin, Phone, User, Weight, Box, FileText, 
  CheckCircle, Link2, Send, Loader2, Navigation, AlertTriangle, Search
} from 'lucide-react';

// ==========================================
// 1. FIREBASE CONFIGURATION
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
// 2. MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);
  
  // Deteksi mode: Admin atau Customer berdasarkan URL Param
  const urlParams = new URLSearchParams(window.location.search);
  const shipIdParam = urlParams.get('shipId');
  const isCustomerMode = !!shipIdParam;

  useEffect(() => {
    // Inject Font Urbanist
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Login Anonymous agar Customer & Admin bisa baca/tulis DB tanpa login
    signInAnonymously(auth).then((userCredential) => {
      setUser(userCredential.user);
      setLoadingApp(false);
    }).catch((error) => {
      console.error("Auth Error:", error);
      setLoadingApp(false);
    });
  }, []);

  if (loadingApp) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center font-['Urbanist']">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
        <p className="text-zinc-400 font-medium tracking-widest uppercase">Memuat Sistem...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-['Urbanist'] selection:bg-yellow-400 selection:text-zinc-900">
      {isCustomerMode ? (
        <CustomerForm shipId={shipIdParam} />
      ) : (
        <AdminForm />
      )}
    </div>
  );
}

// ==========================================
// 3. ADMIN FORM (PREFILL GENERATOR)
// ==========================================
function AdminForm() {
  const [customers, setCustomers] = useState([]);
  const [spks, setSpks] = useState([]);
  const [searchCust, setSearchCust] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    customerID: '',
    customerName: '',
    customerPhone: '',
    selectedSpks: [],
    berat: '',
    koli: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ambil Data Master (Customer & SPK) saat render
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // Ambil Customer (Simulasi fallback jika kosong)
        const custSnapshot = await getDocs(collection(db, "data_customers"));
        let custList = custSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(custList.length === 0) {
            // Mock data jika DB masih kosong
            custList = [
                { id: "CU579221AZI", nama_customer: "Azizah Olshop", nomor_hp: "081234567890" },
                { id: "CU998877BDO", nama_customer: "Budi FC", nomor_hp: "085712341234" }
            ];
        }
        setCustomers(custList);

        // Ambil SPK Produksi (Simulasi fallback jika kosong)
        const spkSnapshot = await getDocs(collection(db, "spk_produksi"));
        let spkList = spkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(spkList.length === 0) {
            // Mock data SPK
            spkList = [
                { id: "0095PO-MCD#002529-CU579221AZI", nama_pesanan: "Jersey Futsal Away" },
                { id: "0096RO-MCD#002530-CU579221AZI", nama_pesanan: "Jacket Tracksuit" },
                { id: "0097PO-MCD#002600-CU998877BDO", nama_pesanan: "Kaos Panitia" }
            ];
        }
        setSpks(spkList);
      } catch (error) {
        console.error("Gagal mengambil master data:", error);
      }
    };
    fetchMasterData();
  }, []);

  // Filter Customer Dropdown
  const filteredCustomers = customers.filter(c => 
    c.nama_customer?.toLowerCase().includes(searchCust.toLowerCase()) || 
    c.id.toLowerCase().includes(searchCust.toLowerCase())
  );

  const handleSelectCustomer = (cust) => {
    setFormData({
      ...formData,
      customerID: cust.id,
      customerName: cust.nama_customer,
      customerPhone: cust.nomor_hp
    });
    setSearchCust(cust.nama_customer);
    setShowCustDropdown(false);
  };

  const toggleSpk = (spkId) => {
    setFormData(prev => {
      const selected = prev.selectedSpks.includes(spkId)
        ? prev.selectedSpks.filter(id => id !== spkId)
        : [...prev.selectedSpks, spkId];
      return { ...prev, selectedSpks: selected };
    });
  };

  const handleGenerateLink = async () => {
    if(!formData.customerID || formData.selectedSpks.length === 0 || !formData.berat || !formData.koli) {
      alert("Mohon lengkapi semua data (Customer, SPK, Berat, dan Koli)!");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Transaction untuk Counter ID
      const counterRef = doc(db, 'metadata', 'shipping_counter');
      let newCount = 1;
      
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (counterDoc.exists()) {
          newCount = (counterDoc.data().count || 0) + 1;
        }
        transaction.set(counterRef, { count: newCount }, { merge: true });
      });

      // 2. Format Nomor ID Alamat
      const paddedCount = String(newCount).padStart(5, '0');
      const nomorIdAlamat = `SHP${paddedCount}${formData.customerID}`;

      // 3. Simpan Draft ke data_alamat_kirim
      const shipRef = doc(db, "data_alamat_kirim", nomorIdAlamat);
      await setDoc(shipRef, {
        nomor_id_alamat: nomorIdAlamat,
        admin_data: {
          customerID: formData.customerID,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          spk_ids: formData.selectedSpks,
          berat_kg: parseFloat(formData.berat),
          koli: parseInt(formData.koli)
        },
        status: "Menunggu Pelanggan",
        created_at: serverTimestamp(),
        customer_data: null
      });

      // 4. Generate Link & Redirect WhatsApp
      const baseUrl = window.location.origin + window.location.pathname;
      const formLink = `${baseUrl}?shipId=${nomorIdAlamat}`;
      
      let phoneWa = formData.customerPhone.replace(/\D/g, '');
      if (phoneWa.startsWith('0')) phoneWa = '62' + phoneWa.substring(1);

      const waText = `Halo kak ${formData.customerName}! 📦✨\n\nPesanan Mandiri Clothing kakak sudah selesai diproduksi dan *SIAP DIKIRIM*.\n\nDetail:\n- Total SPK: ${formData.selectedSpks.length} Pekerjaan\n- Berat: ${formData.berat} Kg\n- Jumlah: ${formData.koli} Koli\n\nMohon bantuannya untuk *mengisi alamat pengiriman lengkap* melalui tautan (link) resmi kami di bawah ini ya kak:\n\n🔗 ${formLink}\n\nTerima kasih! 🙏`;
      
      const waUrl = `https://wa.me/${phoneWa}?text=${encodeURIComponent(waText)}`;
      
      // Buka WA di tab baru
      window.open(waUrl, '_blank');

      // Reset form
      setFormData({ customerID: '', customerName: '', customerPhone: '', selectedSpks: [], berat: '', koli: '' });
      setSearchCust('');
      
    } catch (error) {
      console.error("Error generating link:", error);
      alert("Terjadi kesalahan sistem saat membuat link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-center space-x-3 mb-8">
        <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center rotate-3">
          <Package className="text-zinc-950 w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">MANDIRI <span className="text-yellow-400">SHIPPING</span></h1>
          <p className="text-zinc-400 text-sm">Generator Link Form Pengiriman</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Dekorasi BG */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        {/* 1. Pilih Customer */}
        <div className="space-y-2 relative">
          <label className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
            <User className="w-4 h-4 text-yellow-400" /> Customer ID
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Cari Nama / ID Customer..."
              value={searchCust}
              onChange={(e) => {
                setSearchCust(e.target.value);
                setShowCustDropdown(true);
              }}
              onFocus={() => setShowCustDropdown(true)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-white placeholder-zinc-600"
            />
          </div>
          
          {/* Dropdown Customer */}
          {showCustDropdown && searchCust && (
            <div className="absolute z-10 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map(cust => (
                  <div 
                    key={cust.id} 
                    onClick={() => handleSelectCustomer(cust)}
                    className="p-3 hover:bg-zinc-700 cursor-pointer border-b border-zinc-700/50 last:border-0 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold text-white">{cust.nama_customer}</p>
                      <p className="text-xs text-zinc-400 font-mono">{cust.id}</p>
                    </div>
                    <p className="text-xs text-zinc-500">{cust.nomor_hp}</p>
                  </div>
                ))
              ) : (
                <div className="p-3 text-zinc-500 text-sm text-center">Tidak ditemukan. (Ketik manual jika perlu)</div>
              )}
            </div>
          )}
        </div>

        {/* Info Customer Terpilih */}
        {formData.customerID && (
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <p className="text-yellow-400 text-xs font-bold tracking-wider uppercase mb-1">Target Pengiriman</p>
              <p className="text-lg font-bold text-white">{formData.customerName}</p>
              <p className="text-sm text-zinc-400 font-mono">{formData.customerID} • {formData.customerPhone}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800">
              <CheckCircle className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
        )}

        {/* 2. Pilih SPK */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
            <FileText className="w-4 h-4 text-yellow-400" /> Pilih SPK Produksi (Bisa lebih dari 1)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {spks.map(spk => {
              const isSelected = formData.selectedSpks.includes(spk.id);
              return (
                <button
                  key={spk.id}
                  onClick={() => toggleSpk(spk.id)}
                  className={`text-left p-3 rounded-xl border transition-all duration-200 ${
                    isSelected 
                      ? 'bg-yellow-400/10 border-yellow-400' 
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className={`font-mono text-xs ${isSelected ? 'text-yellow-400' : 'text-zinc-500'}`}>
                      {spk.id.split('-').slice(0, 2).join('-')}
                    </p>
                    {isSelected && <CheckCircle className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <p className={`text-sm font-semibold line-clamp-1 ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                    {spk.nama_pesanan || "Pesanan Mandiri"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Berat & Koli */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
              <Weight className="w-4 h-4 text-yellow-400" /> Berat Total
            </label>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0"
                value={formData.berat}
                onChange={(e) => setFormData({...formData, berat: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 pr-10 focus:outline-none focus:border-yellow-400 text-white font-semibold"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">Kg</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
              <Box className="w-4 h-4 text-yellow-400" /> Jml Koli
            </label>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0"
                value={formData.koli}
                onChange={(e) => setFormData({...formData, koli: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 pr-12 focus:outline-none focus:border-yellow-400 text-white font-semibold"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">Koli</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button 
          onClick={handleGenerateLink}
          disabled={isSubmitting}
          className="w-full mt-6 bg-yellow-400 hover:bg-yellow-500 text-zinc-900 font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Link2 className="w-6 h-6" /> Generate Link & Kirim WA
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 4. CUSTOMER FORM (PUBLIC VIEW)
// ==========================================
function CustomerForm({ shipId }) {
  const [shippingData, setShippingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [namaPenerima, setNamaPenerima] = useState('');
  const [hpPenerima, setHpPenerima] = useState('');
  const [alamatLengkap, setAlamatLengkap] = useState('');
  const [mapPinCoords, setMapPinCoords] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Ambil data draft dari Admin
  useEffect(() => {
    const fetchShippingData = async () => {
      try {
        const docRef = doc(db, "data_alamat_kirim", shipId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setShippingData(data);
          // Auto-fill jika Customer sama dengan Penerima
          if (data.admin_data) {
            setNamaPenerima(data.admin_data.customerName || '');
            setHpPenerima(formatPhoneNum(data.admin_data.customerPhone || ''));
          }
          if(data.status === "Lengkap/Selesai") {
              setIsSuccess(true);
          }
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchShippingData();
  }, [shipId]);

  // Fungsi Format Nomor HP: 0812 3456 7890
  const formatPhoneNum = (value) => {
    const cleaned = ('' + value).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,4})(\d{0,4})(\d{0,4})$/);
    if (match) {
      let intlCode = (match[1] ? match[1] : '');
      return [intlCode, match[2], match[3]].filter(x => x).join(' ');
    }
    return value;
  };

  const handlePhoneChange = (e) => {
    setHpPenerima(formatPhoneNum(e.target.value));
  };

  // Fungsi Ambil Lokasi (HTML5 Geolocation)
  const handleGetLocation = () => {
    setIsGettingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMapPinCoords(`https://maps.google.com/?q=${lat},${lng}`);
          setIsGettingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Gagal mendapatkan lokasi. Pastikan GPS aktif atau izin lokasi diberikan.");
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert("Browser tidak mendukung fitur lokasi.");
      setIsGettingLocation(false);
    }
  };

  const handleSubmitCustomer = async (e) => {
    e.preventDefault();
    if(!namaPenerima || !hpPenerima || !alamatLengkap) {
      alert("Mohon lengkapi Nama, Nomor HP, dan Alamat Lengkap!");
      return;
    }

    setIsSubmitting(true);
    try {
      const docRef = doc(db, "data_alamat_kirim", shipId);
      await updateDoc(docRef, {
        customer_data: {
          nama_penerima: namaPenerima,
          nomor_hp_penerima: hpPenerima.replace(/\s/g, ''), // Simpan tanpa spasi
          alamat_lengkap: alamatLengkap,
          map_pin: mapPinCoords || "Tidak Disertakan"
        },
        status: "Lengkap/Selesai",
        completed_at: serverTimestamp()
      });
      setIsSuccess(true);
    } catch (error) {
      console.error("Error saving address:", error);
      alert("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 text-yellow-400 animate-spin" /></div>;
  
  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Tautan Tidak Valid</h2>
      <p className="text-zinc-400 max-w-sm">Maaf, tautan pengiriman ini tidak ditemukan atau sudah tidak berlaku. Silakan hubungi admin Mandiri Clothing.</p>
    </div>
  );

  if (isSuccess) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
      <div className="w-24 h-24 bg-yellow-400/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <CheckCircle className="w-12 h-12 text-yellow-400" />
      </div>
      <h2 className="text-3xl font-extrabold text-white mb-3">Terima Kasih!</h2>
      <p className="text-zinc-400 max-w-sm mb-8 text-lg">Alamat pengiriman berhasil disimpan. Pesanan Anda akan segera diproses untuk pengiriman.</p>
      
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm text-left">
        <p className="text-xs text-yellow-400 font-bold tracking-wider uppercase mb-1">ID Pengiriman Anda</p>
        <p className="font-mono text-xl text-white break-all">{shipId}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8">
      {/* Header Customer View */}
      <div className="text-center mb-8 pt-4">
        <div className="inline-flex w-16 h-16 bg-yellow-400 rounded-2xl items-center justify-center rotate-3 shadow-lg shadow-yellow-400/20 mb-4">
          <Package className="text-zinc-950 w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-wide">MANDIRI <span className="text-yellow-400">CLOTHING</span></h1>
        <p className="text-zinc-400 mt-2 text-lg">Formulir Alamat Pengiriman</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 md:p-8 shadow-2xl relative">
        {/* Info Ringkasan Pesanan (Read Only) */}
        <div className="mb-8 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-yellow-400"></div>
          <h3 className="text-xs font-bold text-yellow-400 tracking-wider uppercase mb-3">Ringkasan Kiriman</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-3">
             <div>
               <p className="text-xs text-zinc-500 mb-1">Total Berat</p>
               <p className="text-white font-bold text-lg">{shippingData.admin_data?.berat_kg} <span className="text-sm text-zinc-400 font-normal">Kg</span></p>
             </div>
             <div>
               <p className="text-xs text-zinc-500 mb-1">Total Paket</p>
               <p className="text-white font-bold text-lg">{shippingData.admin_data?.koli} <span className="text-sm text-zinc-400 font-normal">Koli</span></p>
             </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">ID Referensi Admin</p>
            <p className="text-zinc-300 font-mono text-xs">{shipId}</p>
          </div>
        </div>

        {/* Formulir Input Pelanggan */}
        <form onSubmit={handleSubmitCustomer} className="space-y-6">
          <h3 className="text-xl font-bold text-white border-b border-zinc-800 pb-2">Detail Penerima</h3>
          
          {/* Nama */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-500" /> Nama Penerima
            </label>
            <input 
              type="text" 
              required
              placeholder="Contoh: Dendra Studio"
              value={namaPenerima}
              onChange={(e) => setNamaPenerima(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-white text-lg placeholder-zinc-700"
            />
          </div>

          {/* No HP */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
              <Phone className="w-4 h-4 text-zinc-500" /> Nomor WhatsApp Aktif
            </label>
            <input 
              type="tel" 
              required
              placeholder="0812 3456 7890"
              value={hpPenerima}
              onChange={handlePhoneChange}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-white text-lg placeholder-zinc-700 font-mono tracking-widest"
            />
          </div>

          {/* Alamat Lengkap */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-zinc-500" /> Alamat Lengkap (Jl, RT/RW, Kel, Kec, Kota, Kodepos)
            </label>
            <textarea 
              required
              rows="4"
              placeholder="Tuliskan alamat selengkap mungkin untuk memudahkan kurir..."
              value={alamatLengkap}
              onChange={(e) => setAlamatLengkap(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-white leading-relaxed placeholder-zinc-700 resize-none"
            ></textarea>
          </div>

          {/* Map Pin (Opsional tapi canggih) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 flex justify-between items-center">
              <span>Titik Koordinat / Link Google Maps <span className="text-xs text-zinc-600 font-normal">(Opsional)</span></span>
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Paste Link Maps atau tap tombol GPS 👉"
                value={mapPinCoords}
                onChange={(e) => setMapPinCoords(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-zinc-300 text-sm placeholder-zinc-700"
              />
              <button 
                type="button"
                onClick={handleGetLocation}
                disabled={isGettingLocation}
                className="bg-zinc-800 hover:bg-zinc-700 text-yellow-400 p-4 rounded-xl border border-zinc-700 transition-all flex items-center justify-center shrink-0 w-16"
                title="Ambil Koordinat GPS Saat Ini"
              >
                {isGettingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-8 bg-yellow-400 hover:bg-yellow-500 text-zinc-900 font-bold text-xl py-5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 shadow-xl shadow-yellow-400/10"
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Send className="w-6 h-6" /> SIMPAN ALAMAT PENGIRIMAN
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}