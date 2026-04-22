import React, { useState, useEffect } from 'react';

export default function App() {
  // --- STATE ---
  const [view, setView] = useState("home");
  const [friends, setFriends] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [groupHistory, setGroupHistory] = useState(() => JSON.parse(localStorage.getItem("groupHistory")) || []);
  
  const [newFriend, setNewFriend] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitMode, setSplitMode] = useState("equal");
  const [exactShares, setExactShares] = useState({});
  const [category, setCategory] = useState("General");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [tempGroupName, setTempGroupName] = useState("");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
  const [editingId, setEditingId] = useState(null);

  const categories = [
    { name: "General", icon: "📦" }, { name: "Food", icon: "🍔" },
    { name: "Transport", icon: "🚗" }, { name: "Shopping", icon: "🛍️" }, { name: "Rent", icon: "🏠" }
  ];

  const carouselItems = [
    { title: "Split Instantly", text: "Divide group bills in seconds without manual math.", icon: "⚡" },
    { title: "Exact Shares", text: "Assign specific amounts to each person easily.", icon: "🎯" },
    { title: "Smart Settlement", text: "The system finds the shortest path to pay back.", icon: "🧠" },
    { title: "Expense History", text: "Save and track your group sessions for later.", icon: "📂" }
  ];

  // --- PERSISTENCE ---
  useEffect(() => {
    if (friends.length > 0 && !paidBy) setPaidBy(friends[0]);
  }, [friends, paidBy]);

  useEffect(() => {
    localStorage.setItem("groupHistory", JSON.stringify(groupHistory));
  }, [groupHistory]);

  // --- LOGIC ---
  const getExactTotal = () => {
    if (splitMode === "percentage") {
        const totalPct = Object.values(exactShares).reduce((a, b) => a + (parseFloat(b) || 0), 0);
        return (totalPct / 100) * (parseFloat(amount) || 0);
    }
    return Object.values(exactShares).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  };

  const isMathValid = () => {
    if (splitMode === "equal") return true;
    const total = parseFloat(amount) || 0;
    if (splitMode === "percentage") {
        const totalPct = Object.values(exactShares).reduce((a, b) => a + (parseFloat(b) || 0), 0);
        return Math.abs(totalPct - 100) < 0.01;
    }
    return Math.abs(getExactTotal() - total) < 0.01;
  };

  const getBalances = () => {
    const balances = {};
    friends.forEach(f => balances[f] = 0);
    expenses.forEach(exp => {
      if (exp.isPayment) {
        balances[exp.paidBy] += exp.amount; balances[exp.paidTo] -= exp.amount;
      } else {
        const share = exp.splitMode === "equal" ? exp.amount / friends.length : 0;
        friends.forEach(f => {
          let s = 0;
          if (exp.splitMode === "equal") s = share;
          else if (exp.splitMode === "percentage") s = (parseFloat(exp.shares[f] || 0) / 100) * exp.amount;
          else s = parseFloat(exp.shares[f] || 0);
          
          balances[f] += (f === exp.paidBy ? exp.amount - s : -s);
        });
      }
    });
    return balances;
  };

  const getSettlements = () => {
    let b = { ...getBalances() };
    const tx = [];
    while (true) {
      let d = null, c = null;
      for (let f of friends) {
        if (!d || b[f] < b[d]) d = f;
        if (!c || b[f] > b[c]) c = f;
      }
      if (!d || b[d] >= -0.01 || b[c] <= 0.01) break;
      const amt = Math.min(Math.abs(b[d]), b[c]);
      tx.push({ from: d, to: c, amount: amt.toFixed(2) });
      b[d] += amt; b[c] -= amt;
    }
    return tx;
  };

  // --- ACTIONS ---
  const handleAddMember = (e) => {
    if (e) e.preventDefault();
    if (newFriend.trim() && !friends.includes(newFriend.trim())) {
      setFriends([...friends, newFriend.trim()]);
      setNewFriend("");
    }
  };

  const removeMember = (name) => {
    setFriends(friends.filter(f => f !== name));
    if (paidBy === name) setPaidBy(friends[0] || "");
  };

  const addExpense = (e) => {
    e.preventDefault();
    if (!isMathValid() || !amount || !desc) return;
    
    const newExpense = { 
        id: editingId || Date.now(), 
        desc, 
        amount: parseFloat(amount), 
        paidBy, 
        category, 
        splitMode, 
        shares: exactShares, 
        date: new Date().toLocaleDateString(), 
        isPayment: false 
    };

    if (editingId) {
        setExpenses(expenses.map(exp => exp.id === editingId ? newExpense : exp));
        setEditingId(null);
    } else {
        setExpenses([newExpense, ...expenses]);
    }

    setDesc(""); setAmount(""); setExactShares({}); setSplitMode("equal");
  };

  const editExpense = (exp) => {
    if (exp.isPayment) return;
    setEditingId(exp.id);
    setDesc(exp.desc);
    setAmount(exp.amount.toString());
    setPaidBy(exp.paidBy);
    setCategory(exp.category);
    setSplitMode(exp.splitMode);
    setExactShares(exp.shares);
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const settleDebt = (from, to, amt) => {
    setExpenses([{ id: Date.now(), desc: `Settle: ${from} → ${to}`, amount: parseFloat(amt), paidBy: from, paidTo: to, date: new Date().toLocaleDateString(), isPayment: true }, ...expenses]);
  };

  const saveGroup = () => {
    if (!tempGroupName.trim()) return;
    const newEntry = {
      id: Date.now(),
      name: tempGroupName,
      friends: [...friends],
      expenses: [...expenses],
      date: new Date().toLocaleDateString()
    };
    setGroupHistory([newEntry, ...groupHistory]);
    
    // Clear all current session data automatically
    setFriends([]);
    setExpenses([]);
    setNewFriend("");
    setDesc("");
    setAmount("");
    setExactShares({});
    
    setTempGroupName("");
    setShowSaveModal(false);
    setView("home");
  };

  const deleteHistory = (id, e) => {
    e.stopPropagation();
    if(confirm("Delete this history?")) setGroupHistory(groupHistory.filter(g => g.id !== id));
  };

  const exportToCSV = () => {
    let csv = "Date,Description,Amount,Paid By,Category\n";
    expenses.forEach(e => {
        csv += `${e.date},${e.desc},${e.amount},${e.paidBy},${e.category || 'Payment'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `SplitwisePlus_Export_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowExportDropdown(false);
  };

  const exportToPDF = () => {
    window.print();
    setShowExportDropdown(false);
  };

  // --- RENDER HOME ---
  if (view === "home") {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/20 blur-[120px] animate-pulse"></div>

        <div className="relative z-10 w-full max-w-6xl space-y-12">
          <div className="text-center space-y-4 animate-fade-in">
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent italic leading-tight">
              SPLITWISE<span className="not-italic text-white">+</span>
            </h1>
            <p className="text-indigo-200 font-bold tracking-[0.4em] text-[10px] uppercase">Premium Group Settlement Engine</p>
          </div>

          <div className="carousel-container relative w-full h-[350px] md:h-[400px] flex items-center justify-center">
            <div className="revolve-wrapper">
              {carouselItems.map((item, idx) => (
                <div key={idx} className="revolve-card" style={{ '--i': idx }}>
                  <div className="w-[220px] h-[200px] md:w-[280px] md:h-[250px] bg-white/10 border border-white/20 p-6 md:p-8 rounded-[2.5rem] backdrop-blur-xl flex flex-col items-center text-center shadow-2xl">
                    <div className="text-3xl md:text-4xl mb-3 md:mb-4">{item.icon}</div>
                    <h3 className="font-black text-slate-800 uppercase text-[10px] md:text-xs tracking-widest mb-2 bg-white/80 px-3 py-1 rounded-full">{item.title}</h3>
                    <p className="text-slate-200 text-xs md:text-sm leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-10">
            <div className="bg-gradient-to-br from-indigo-600 to-fuchsia-700 p-[1px] rounded-[3rem] shadow-2xl">
              <div className="bg-[#0A0A0A] p-10 rounded-[3rem] h-full flex flex-col">
                <h2 className="text-2xl font-black mb-6 italic text-white">New Session</h2>
                <div className="relative group mb-6">
                  <input 
                    value={newFriend} 
                    onChange={(e) => setNewFriend(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                    placeholder="Member Name" 
                    className="w-full px-6 py-4 pr-24 rounded-2xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none transition-all font-bold text-white" 
                  />
                  <button 
                    onClick={handleAddMember}
                    className="absolute right-2 top-2 bottom-2 bg-white text-black px-6 rounded-xl font-black hover:bg-indigo-300 transition-all text-xs"
                  >ADD</button>
                </div>
                <div className="flex flex-wrap gap-2 mb-8 min-h-[50px]">
                  {friends.map(f => (
                    <span key={f} className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 pl-4 pr-2 py-2 rounded-xl text-[10px] font-black animate-pop flex items-center gap-2">
                        {f}
                        <button onClick={() => removeMember(f)} className="hover:text-rose-500 text-lg leading-none">×</button>
                    </span>
                  ))}
                </div>
                {friends.length >= 2 && (
                  <button onClick={() => setView("dashboard")} className="mt-auto w-full bg-white text-black py-5 rounded-2xl font-black text-lg hover:shadow-indigo-500/20 shadow-xl transition-all">LAUNCH DASHBOARD</button>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] backdrop-blur-3xl">
              <h2 className="text-2xl font-black mb-6 text-slate-400">History</h2>
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                {groupHistory.map(g => (
                  <div key={g.id} onClick={() => {setFriends(g.friends); setExpenses(g.expenses); setView("dashboard");}} className="group bg-white/5 p-6 rounded-[2rem] border border-white/5 hover:border-fuchsia-500/50 transition-all cursor-pointer flex justify-between items-center">
                    <div>
                      <p className="font-black text-lg text-white group-hover:text-fuchsia-400 transition-colors">{g.name}</p>
                      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mt-1">{g.date} • {g.friends.length} Members</p>
                    </div>
                    <button onClick={(e) => deleteHistory(g.id, e)} className="p-2 text-slate-600 hover:text-rose-500 transition-all"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                  </div>
                ))}
                {groupHistory.length === 0 && <div className="text-center py-20 opacity-20 italic">No saved groups.</div>}
              </div>
            </div>
          </div>
        </div>

        <style>{`
          .carousel-container { perspective: 1200px; display: flex; justify-content: center; align-items: center; overflow: visible; }
          .revolve-wrapper { position: relative; width: 0px; height: 0px; transform-style: preserve-3d; animation: revolve 25s linear infinite; }
          .revolve-wrapper:hover { animation-play-state: paused; }
          .revolve-card { position: absolute; left: -110px; top: -100px; width: 220px; height: 200px; transform-style: preserve-3d; transform: rotateY(calc(var(--i) * 90deg)) translateZ(180px); backface-visibility: visible; }
          @media (min-width: 768px) { .revolve-card { left: -140px; top: -125px; width: 280px; height: 250px; transform: rotateY(calc(var(--i) * 90deg)) translateZ(320px); } }
          @keyframes revolve { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
          .animate-fade-in { animation: fadeIn 0.6s ease-out; }
          .animate-pop { animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        `}</style>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] animate-fade-in font-sans print:bg-white">
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-5 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-3 md:gap-6">
          <button onClick={() => { if(confirm("Go back to home? Progress may be lost if not saved.")) setView("home"); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-indigo-600">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M19 12H5m7 7l-7-7 7-7"/></svg>
          </button>
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter cursor-pointer" onClick={() => setView("home")}>SPLITWISE<span className="text-indigo-600">+</span></h2>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="px-3 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <span className="hidden md:inline">Export</span>
              <svg className={`transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </button>
            
            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 animate-pop overflow-hidden">
                <button onClick={exportToCSV} className="w-full text-left px-5 py-3 text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors uppercase tracking-widest border-b border-slate-50">Download CSV</button>
                <button onClick={exportToPDF} className="w-full text-left px-5 py-3 text-[10px] font-black text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors uppercase tracking-widest">Download PDF</button>
              </div>
            )}
          </div>
          
          {/* CANCEL AND SAVE BUTTONS SIDE BY SIDE */}
          <div className="flex gap-2">
            <button 
              onClick={() => { if(confirm("Discard this session?")) { setFriends([]); setExpenses([]); setView("home"); }}} 
              className="px-3 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black text-slate-400 bg-slate-100 hover:bg-rose-50 hover:text-rose-500 uppercase tracking-widest transition-all"
            >Cancel</button>
            <button onClick={() => setShowSaveModal(true)} className="px-3 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black text-white bg-slate-900 hover:bg-indigo-600 shadow-xl shadow-slate-200 uppercase tracking-widest transition-all">Save</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10 grid lg:grid-cols-12 gap-8 print:block print:p-0">
        <div className="lg:col-span-4 space-y-6 print:hidden">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">{editingId ? 'Edit Bill' : 'Split New Bill'}</h3>
            <form onSubmit={addExpense} className="space-y-4">
              <div className="flex gap-2 mb-4">{categories.map(c => (
                <button key={c.name} type="button" onClick={() => setCategory(c.name)} className={`flex-1 py-3 rounded-2xl text-xl transition-all ${category === c.name ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-50 hover:bg-slate-100'}`}>{c.icon}</button>
              ))}</div>
              <input required value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What was this for?" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-600 font-bold" />
              <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₹ 0.00" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 outline-none font-black text-2xl text-indigo-600" />
              
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button type="button" onClick={() => {setSplitMode("equal"); setExactShares({});}} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${splitMode === "equal" ? 'bg-white shadow-sm' : 'text-slate-400'}`}>EQUAL</button>
                <button type="button" onClick={() => {setSplitMode("exact"); setExactShares({});}} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${splitMode === "exact" ? 'bg-white shadow-sm' : 'text-slate-400'}`}>EXACT</button>
                <button type="button" onClick={() => {setSplitMode("percentage"); setExactShares({});}} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${splitMode === "percentage" ? 'bg-white shadow-sm' : 'text-slate-400'}`}>% PCT</button>
              </div>

              {(splitMode === "exact" || splitMode === "percentage") && (
                <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                  {friends.map(f => (
                    <div key={f} className="flex justify-between items-center">
                      <span className="text-xs font-black text-slate-500">{f}</span>
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.01" value={exactShares[f] || ""} onChange={(e) => setExactShares({...exactShares, [f]: e.target.value})} className="w-20 bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-right font-bold outline-none" placeholder="0" />
                        <span className="text-[10px] font-bold text-slate-400">{splitMode === "percentage" ? '%' : '₹'}</span>
                      </div>
                    </div>
                  ))}
                  <p className={`text-[10px] font-black text-center pt-2 ${isMathValid() ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {splitMode === "percentage" ? `Total: ${Object.values(exactShares).reduce((a,b)=>a+(parseFloat(b)||0),0)}/100%` : `Sum: ₹${getExactTotal()}`}
                  </p>
                </div>
              )}

              <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 outline-none font-black cursor-pointer appearance-none">
                {friends.map(f => <option key={f} value={f}>{f} Paid</option>)}
              </select>

              <div className="flex gap-2">
                {editingId && <button type="button" onClick={() => {setEditingId(null); setDesc(""); setAmount("");}} className="flex-1 py-5 rounded-[1.5rem] font-black text-slate-400 bg-slate-100">CANCEL</button>}
                <button disabled={!isMathValid()} className={`flex-[2] py-5 rounded-[1.5rem] font-black text-lg shadow-xl transition-all active:scale-95 ${isMathValid() ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {editingId ? 'UPDATE BILL' : 'SPLIT BILL'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-4 tracking-[0.2em]">Group Members</h3>
            <div className="flex flex-wrap gap-2 mb-6">
                {friends.map(f => (
                    <div key={f} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-wider">{f}</span>
                        <button onClick={() => removeMember(f)} className="text-rose-400 hover:text-rose-300 font-bold ml-1">×</button>
                    </div>
                ))}
            </div>
            <div className="relative flex items-center">
              <input 
                value={newFriend} 
                onChange={(e) => setNewFriend(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                placeholder="New Name" 
                className="w-full bg-white/10 border-none rounded-2xl px-5 py-4 pr-24 text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500" 
              />
              <button 
                onClick={handleAddMember} 
                className="absolute right-2 bg-indigo-600 px-5 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-500 transition-colors"
              >ADD</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 h-full print:mb-10">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 min-h-full print:border-none print:p-0">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Settlements</h3>
            <div className="space-y-4">
              {getSettlements().map((s, i) => (
                <div key={i} className="bg-slate-50 p-8 rounded-[2.5rem] text-center border border-slate-100 hover:border-indigo-300 transition-all group print:border print:bg-white print:rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{s.from} owes</p>
                  <p className="text-4xl font-black text-indigo-600 my-1">₹{s.amount}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-6 print:mb-0">to {s.to}</p>
                  <button onClick={() => settleDebt(s.from, s.to, s.amount)} className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all print:hidden">Settle Debt</button>
                </div>
              ))}
              {getSettlements().length === 0 && <div className="text-center py-24 opacity-20 font-black uppercase text-xs tracking-widest">Balance Clean ✨</div>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 h-[700px] flex flex-col print:h-auto print:border-none print:p-0">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Activity History</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar print:overflow-visible">
              {expenses.map(exp => (
                <div key={exp.id} className={`group p-5 rounded-3xl border transition-all print:bg-white print:rounded-xl ${exp.isPayment ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl print:hidden">{exp.isPayment ? '✅' : categories.find(c => c.name === exp.category)?.icon}</span>
                      <div>
                        <p className="font-bold text-sm text-slate-800 leading-tight">{exp.desc}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{exp.date} {!exp.isPayment && `• ${exp.paidBy}`}</p>
                      </div>
                    </div>
                    <div className="text-right">
                        <p className={`font-mono font-black text-lg ${exp.isPayment ? 'text-emerald-600' : 'text-indigo-600'}`}>₹{exp.amount}</p>
                        {!exp.isPayment && (
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                <button onClick={() => editExpense(exp)} className="text-[9px] font-black text-indigo-500 uppercase">Edit</button>
                                <button onClick={() => deleteExpense(exp.id)} className="text-[9px] font-black text-rose-500 uppercase">Undo</button>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-fade-in print:hidden">
          <div className="bg-white w-full max-w-md p-10 rounded-[3rem] animate-pop shadow-2xl">
            <h2 className="text-2xl font-black mb-1 text-slate-900">Name Group</h2>
            <p className="text-slate-400 mb-6 text-sm font-medium italic">Example: Goa Trip 2026...</p>
            <input 
              autoFocus 
              value={tempGroupName} 
              onChange={(e) => setTempGroupName(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && saveGroup()}
              className="w-full bg-slate-100 border-none rounded-2xl px-6 py-4 outline-none font-black text-xl mb-6 focus:ring-2 focus:ring-indigo-600" 
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveModal(false)} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase text-slate-400 bg-slate-50">Cancel</button>
              <button onClick={saveGroup} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase text-white bg-indigo-600 shadow-xl shadow-indigo-100">Save Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}