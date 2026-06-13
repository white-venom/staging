import os

def optimize():
    filepath = "superadmin-frontend/src/app/page.tsx"
    if not os.path.exists(filepath):
        print(f"Error: {filepath} not found")
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replacement 1: Toast Notification
    old_toast = """      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-5 py-4 bg-white border border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center gap-3 shadow-[0_10px_35px_rgba(0,0,0,0.08)] animate-bounce text-xs font-black uppercase tracking-wider">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
          {toastMessage}
        </div>
      )}"""
      
    new_toast = """      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-2 bg-white border border-emerald-500/20 text-emerald-650 rounded-lg flex items-center gap-2 shadow-lg animate-bounce text-[10px] font-black uppercase tracking-wider">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          {toastMessage}
        </div>
      )}"""

    # Replacement 2: Header Bar
    old_header = """      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0d1b3e] border-b border-blue-900/40 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="CrediiFlow Logo" 
            className="h-9 w-auto object-contain"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black uppercase text-slate-100 tracking-wider">{adminName}</p>
            <p className="text-[10px] font-bold text-blue-200/70 uppercase mt-0.5">@{username}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-blue-800 hover:border-red-400 hover:bg-red-955/30 text-blue-200 hover:text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>"""

    # Wait, in the backup, is it red-950/30 or red-955/30? Let's check:
    # Actually, let's just search and replace the main parameters.
    # To be extremely safe, we will do targeted substring replaces.

    # Substring 1: Header padding, gap and logo height
    content = content.replace(
        'sticky top-0 z-40 bg-[#0d1b3e] border-b border-blue-900/40 px-6 py-4 flex items-center justify-between shadow-md',
        'sticky top-0 z-40 bg-[#0d1b3e] border-b border-blue-900/40 px-3.5 py-2 flex items-center justify-between shadow-md'
    )
    content = content.replace(
        '<div className="flex items-center gap-3">\n          <img \n            src="/logo.png" \n            alt="CrediiFlow Logo" \n            className="h-9 w-auto object-contain"\n          />',
        '<div className="flex items-center gap-2">\n          <img \n            src="/logo.png" \n            alt="CrediiFlow Logo" \n            className="h-7 w-auto object-contain"\n          />'
    )
    content = content.replace(
        '<div className="flex items-center gap-4">',
        '<div className="flex items-center gap-3">'
    )
    content = content.replace(
        'p className="text-xs font-black uppercase text-slate-100 tracking-wider"',
        'p className="text-[10px] font-black uppercase text-slate-100 tracking-wider"'
    )
    content = content.replace(
        'p className="text-[10px] font-bold text-blue-200/70 uppercase mt-0.5"',
        'p className="text-[8px] font-bold text-blue-200/70 uppercase mt-0.5"'
    )
    content = content.replace(
        'className="px-4 py-2 border border-blue-800 hover:border-red-400 hover:bg-red-955/30 text-blue-200 hover:text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"',
        'className="px-2.5 py-1 border border-blue-800 hover:border-red-400 hover:bg-red-955/30 text-blue-200 hover:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"'
    )
    content = content.replace(
        'className="px-4 py-2 border border-blue-800 hover:border-red-400 hover:bg-red-950/30 text-blue-200 hover:text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"',
        'className="px-2.5 py-1 border border-blue-800 hover:border-red-400 hover:bg-red-950/30 text-blue-200 hover:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"'
    )

    # Substring 2: Content Area padding
    content = content.replace(
        'main className="max-w-7xl mx-auto px-6 py-8 relative z-10"',
        'main className="max-w-7xl mx-auto px-4 py-4 relative z-10"'
    )

    # Substring 3: Welcome Section
    content = content.replace(
        'div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10"',
        'div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4"'
    )
    content = content.replace(
        'h1 className="text-3xl font-black uppercase tracking-tight text-slate-900"',
        'h1 className="text-xl font-black uppercase tracking-tight text-slate-900"'
    )
    content = content.replace(
        'p className="text-slate-500 text-sm mt-1.5 font-medium"',
        'p className="text-slate-500 text-[10px] mt-0.5 font-medium"'
    )
    content = content.replace(
        'className="self-start md:self-auto px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md hover:shadow-lg shadow-indigo-600/10 active:scale-[0.98] cursor-pointer"',
        'className="self-start md:self-auto px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md active:scale-[0.98] cursor-pointer"'
    )

    # Substring 4: Tab Controls spacing
    content = content.replace(
        'div className="flex items-center gap-2 border-b border-slate-200 mb-8 pb-px"',
        'div className="flex items-center gap-1 border-b border-slate-200 mb-4 pb-px"'
    )
    content = content.replace(
        'px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all duration-250',
        'px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all duration-250'
    )
    content = content.replace(
        'Resource usage Visualizer',
        'Resource Visualizer'
    )

    # Substring 5: Stats Grid
    content = content.replace(
        'space-y-8 animate-fade-in',
        'space-y-4 animate-fade-in'
    )
    content = content.replace(
        'grid grid-cols-1 md:grid-cols-3 gap-6',
        'grid grid-cols-1 md:grid-cols-3 gap-3'
    )
    content = content.replace(
        'rounded-2xl p-6 shadow-sm',
        'rounded-lg p-3 shadow-sm'
    )
    content = content.replace(
        'text-4xl font-black mt-2 text-violet-650',
        'text-xl font-black mt-1 text-violet-650'
    )
    content = content.replace(
        'text-4xl font-black mt-2 text-emerald-600',
        'text-xl font-black mt-1 text-emerald-600'
    )
    content = content.replace(
        'text-lg font-mono font-black mt-4 text-slate-705',
        'text-[13px] font-mono font-black mt-2 text-slate-705'
    )
    content = content.replace(
        'text-lg font-mono font-black mt-4 text-slate-700',
        'text-[13px] font-mono font-black mt-2 text-slate-700'
    )
    content = content.replace(
        'text-[10px] text-slate-400 font-bold mt-2.5 uppercase tracking-wide',
        'text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wide'
    )
    content = content.replace(
        'text-[10px] text-emerald-500 font-bold mt-2.5 uppercase tracking-wide',
        'text-[9px] text-emerald-500 font-bold mt-1 uppercase tracking-wide'
    )

    # Substring 6: Tenant Directory Table & Headings
    content = content.replace(
        'px-6 py-5 border-b border-slate-200/80 bg-slate-50/55 flex items-center justify-between',
        'px-3.5 py-2 border-b border-slate-200/80 bg-slate-50/55 flex items-center justify-between'
    )
    content = content.replace(
        'px-6 py-5 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between',
        'px-3.5 py-2 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between'
    )
    content = content.replace(
        'text-xs text-indigo-650 hover:text-indigo-700 font-black uppercase tracking-wider',
        'text-[10px] text-indigo-650 hover:text-indigo-700 font-black uppercase tracking-wider'
    )
    content = content.replace(
        'bg-slate-50/70 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-200/80',
        'bg-slate-50/70 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-200/80'
    )
    # table th and td paddings
    content = content.replace('px-6 py-4', 'px-3.5 py-2') # headers
    content = content.replace('px-6 py-4', 'px-3.5 py-1.5') # rows - wait, in table row it is 'px-6 py-4' too, python replace does it sequentially, which is fine!
    content = content.replace('divide-y divide-slate-100 text-xs text-slate-700', 'divide-y divide-slate-100 text-xs text-slate-705')
    content = content.replace('transition-colors duration-150', 'transition-colors duration-155')
    content = content.replace('px-2.5 py-0.5 rounded-full text-[10px]', 'px-1.5 py-0.5 rounded-full text-[8px]')
    content = content.replace('px-3 py-1.5 rounded-xl text-[10px] font-black', 'px-2 py-0.5 rounded text-[8px] font-black')
    content = content.replace('p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/60 rounded-lg', 'p-1 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/60 rounded')
    content = content.replace('p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/40 rounded-lg', 'p-1 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200/40 rounded')
    content = content.replace('gap-2', 'gap-1')

    # Substring 7: Resource Visualizer Layout & Sidebar
    content = content.replace('lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 h-fit space-y-3 shadow-sm', 'lg:col-span-4 bg-white border border-slate-200/80 rounded-lg p-2.5 h-fit space-y-2 shadow-sm')
    content = content.replace('text-xs font-black uppercase tracking-wider text-slate-400 mb-4 px-2', 'text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 px-1')
    content = content.replace('p-4 rounded-xl text-left border flex items-center justify-between transition-all duration-200', 'p-2.5 rounded-lg text-left border flex items-center justify-between transition-all duration-205')
    content = content.replace('text-xs font-bold uppercase tracking-wider', 'text-[11px] font-bold uppercase tracking-wider')
    content = content.replace('text-[10px] text-slate-400 mt-1', 'text-[9px] text-slate-400 mt-0.5')
    content = content.replace('w-2 h-2 rounded-full', 'w-1.5 h-1.5 rounded-full')
    content = content.replace('lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-8 space-y-8 shadow-sm relative overflow-hidden', 'lg:col-span-8 bg-white border border-slate-200/80 rounded-lg p-4 space-y-4 shadow-sm relative overflow-hidden')
    content = content.replace('w-32 h-32 bg-violet-500/5', 'w-24 h-24 bg-violet-500/5')
    content = content.replace('pb-5 gap-3', 'pb-3 gap-2')
    content = content.replace('text-xl font-black uppercase tracking-tight', 'text-base font-black uppercase tracking-tight')
    content = content.replace('text-xs text-indigo-650 mt-1 font-bold', 'text-[9px] text-indigo-650 mt-0.5 font-bold')
    content = content.replace('px-3 py-1.5 rounded-full text-[10px] font-black', 'px-2 py-0.5 rounded-full text-[8px] font-black')
    
    # gauges
    content = content.replace('p-5 rounded-2xl border border-slate-200/60 space-y-4', 'p-3 rounded-lg border border-slate-200/60 space-y-2')
    content = content.replace('text-[10px] font-black text-slate-400 uppercase tracking-widest', 'text-[9px] font-black text-slate-400 uppercase tracking-widest')
    content = content.replace('text-xs font-black text-violet-650', 'text-[10px] font-black text-violet-650')
    content = content.replace('text-xs font-black text-indigo-600', 'text-[10px] font-black text-indigo-605')
    content = content.replace('text-xs font-black text-blue-600', 'text-[10px] font-black text-blue-600')
    content = content.replace('h-3 rounded-full', 'h-1.5 rounded-full')
    content = content.replace('bg-slate-200/50 rounded-full h-3 overflow-hidden', 'bg-slate-200/50 rounded-full h-1.5 overflow-hidden')
    content = content.replace('text-[9px] font-bold text-slate-400 uppercase', 'text-[8px] font-bold text-slate-400 uppercase')
    
    # specs
    content = content.replace('p-5 bg-slate-50/50 border border-slate-200/60 rounded-2xl space-y-4 text-slate-700', 'p-3 bg-slate-50/50 border border-slate-200/60 rounded-lg space-y-2 text-slate-700')
    content = content.replace('text-[10px] font-black uppercase tracking-wider text-slate-400', 'text-[9px] font-black uppercase tracking-wider text-slate-400')
    content = content.replace('gap-4 text-xs', 'gap-3 text-[10px]')
    content = content.replace('text-indigo-600 uppercase tracking-wider', 'text-indigo-650 uppercase tracking-wider')

    # Substring 8: Tab 3 Infrastructure health
    content = content.replace('rounded-2xl p-6 space-y-4 shadow-sm', 'rounded-lg p-3 space-y-2 shadow-sm')
    content = content.replace('pb-2', 'pb-1.5')
    content = content.replace('text-xs font-black uppercase tracking-wider text-slate-800', 'text-[10px] font-black uppercase tracking-wider text-slate-800')
    content = content.replace('w-2.5 h-2.5 rounded-full', 'w-2 h-2 rounded-full')
    content = content.replace('space-y-1 text-xs text-slate-650', 'space-y-0.5 text-[10px] text-slate-650')
    content = content.replace('space-y-1 text-xs text-slate-655', 'space-y-0.5 text-[10px] text-slate-655')
    content = content.replace('text-slate-855', 'text-slate-850')
    content = content.replace('font-bold text-indigo-650 uppercase tracking-widest text-[10px]', 'font-bold text-indigo-650 uppercase tracking-widest text-[8px]')
    
    # Docker Container table
    content = content.replace('text-sm font-black uppercase tracking-wider text-slate-800', 'text-[10px] font-black uppercase tracking-wider text-slate-800')
    content = content.replace('text-xs', 'text-[10px]')
    content = content.replace('text-slate-455 text-[10px] font-black', 'text-slate-455 text-[9px] font-black')
    content = content.replace('text-slate-700', 'text-slate-755')
    content = content.replace('px-2.5 py-0.5 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-full font-black uppercase tracking-wider text-[9px]', 'px-2 py-0.5 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-full font-black uppercase tracking-wider text-[8px]')

    # Substring 9: Modals
    content = content.replace('w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden relative text-slate-700', 'w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden relative text-slate-700')
    content = content.replace('px-6 py-5 border-b border-slate-100', 'px-3 py-2 border-b border-slate-100')
    content = content.replace('text-sm font-black uppercase tracking-wider text-slate-900', 'text-xs font-black uppercase tracking-wider text-slate-900')
    content = content.replace('text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 focus:outline-none cursor-pointer transition-colors', 'text-slate-400 hover:text-slate-650 p-1 rounded-lg hover:bg-slate-100 focus:outline-none cursor-pointer transition-colors')
    content = content.replace('w-4 h-4', 'w-3.5 h-3.5')
    content = content.replace('mx-6 mt-6 p-4 text-xs bg-red-50 border border-red-200/50 text-red-650 rounded-xl', 'mx-3 mt-3 p-2 text-[10px] bg-red-50 border border-red-200/50 text-red-650 rounded-lg')
    content = content.replace('p-6 space-y-6', 'p-3.5 space-y-2.5')
    content = content.replace('gap-5', 'gap-2')
    content = content.replace('text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2', 'text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5')
    content = content.replace('px-4 py-2.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-xs font-bold', 'px-2.5 py-1.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[11px] font-bold')
    content = content.replace('pl-4 pr-24 py-2.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-xs font-bold', 'pl-2.5 pr-20 py-1.5 bg-slate-50/50 border border-slate-205 focus:border-violet-500 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[11px] font-bold')
    content = content.replace('right-3 text-[10px] font-black text-slate-400', 'right-2 text-[8px] font-black text-slate-400')
    content = content.replace('p-5 bg-slate-50/50 border border-slate-200/60 rounded-2xl space-y-4', 'p-2.5 bg-slate-50/50 border border-slate-200/60 rounded-lg space-y-2')
    content = content.replace('text-[10px] font-black uppercase tracking-widest text-slate-500', 'text-[8px] font-black uppercase tracking-widest text-slate-500')
    content = content.replace('text-[10px] font-black text-slate-450 uppercase tracking-widest mb-2', 'text-[8px] font-black text-slate-450 uppercase tracking-widest mb-0.5')
    content = content.replace('px-4 py-2.5 bg-white border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-xs font-bold', 'px-2.5 py-1.5 bg-white border border-slate-205 focus:border-violet-500 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[11px] font-bold')
    content = content.replace('gap-4', 'gap-2')
    content = content.replace('text-[10px] font-black text-slate-455 uppercase tracking-widest mb-2', 'text-[8px] font-black text-slate-455 uppercase tracking-widest mb-0.5')
    content = content.replace('pl-4 pr-12 py-2.5 bg-white border border-slate-205 focus:border-violet-500 rounded-xl text-slate-805 placeholder-slate-405 focus:outline-none transition-all duration-200 text-xs font-bold', 'pl-2.5 pr-8 py-1.5 bg-white border border-slate-205 focus:border-violet-500 rounded-lg text-slate-805 placeholder-slate-405 focus:outline-none transition-all duration-200 text-[11px] font-bold')
    content = content.replace('pl-4 pr-12 py-2.5 bg-white border border-slate-205 focus:border-violet-500 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-xs font-bold', 'pl-2.5 pr-8 py-1.5 bg-white border border-slate-205 focus:border-violet-500 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200 text-[11px] font-bold')
    content = content.replace('right-3 top-1/2', 'right-2 top-1/2')
    content = content.replace('pt-4 border-t border-slate-100', 'pt-2.5 border-t border-slate-100')
    content = content.replace('px-4 py-2.5 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer', 'px-3 py-1.5 border border-slate-205 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer')
    content = content.replace('px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer', 'px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer')
    
    # Edit / delete modals specific changes
    content = content.replace('px-4 py-2.5 border border-slate-205 text-slate-450 hover:text-slate-655 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer', 'px-3 py-1.5 border border-slate-205 text-slate-450 hover:text-slate-655 hover:bg-slate-50 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer')
    content = content.replace('px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer', 'px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer')
    content = content.replace('px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer', 'px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer')
    
    # Delete confirmation modal specific
    content = content.replace('w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-2xl overflow-hidden relative text-slate-700', 'w-full max-w-sm bg-white border border-red-200 rounded-lg shadow-2xl overflow-hidden relative text-slate-700')
    content = content.replace('px-6 py-5 border-b border-red-100 flex items-center justify-between bg-red-50/50', 'px-3 py-2 border-b border-red-100 flex items-center justify-between bg-red-50/50')
    content = content.replace('text-red-650 flex items-center gap-2', 'text-red-655 flex items-center gap-1')
    content = content.replace('p-4 bg-red-50 border border-red-200 text-xs text-red-650 leading-relaxed font-bold rounded-xl', 'p-2.5 bg-red-50 border border-red-200 text-[10px] text-red-650 leading-relaxed font-bold rounded-lg')
    content = content.replace('Type <span className="text-slate-900 font-black">{deleteClientName}</span> to confirm deletion:', 'Type <span className="text-slate-900 font-black">{deleteClientName}</span> to confirm:')
    content = content.replace('px-4 py-2.5 border border-slate-205 text-slate-450 hover:text-slate-650 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer', 'px-3 py-1.5 border border-slate-205 text-slate-455 hover:text-slate-650 hover:bg-slate-100 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer')
    content = content.replace('px-5 py-2.5 bg-red-600 hover:bg-red-550 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer', 'px-4 py-1.5 bg-red-655 hover:bg-red-550 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-200 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer')
    content = content.replace('WARNING: This action is permanent and cannot be undone. This will completely delete the database <span className="font-mono bg-red-100/70 px-1.5 py-0.5 rounded font-black text-red-750">crediiflow_{deleteClientName.toLowerCase().replace(/\\s+/g, "_")}</span> and all client transactions, ledger data, and configs will be wiped.', 'WARNING: Wipes <span className="font-mono bg-red-105/70 px-1 py-0.5 rounded font-black text-red-750">crediiflow_{deleteClientName.toLowerCase().replace(/\\s+/g, "_")}</span>. All client data and configs will be destroyed.')

    # Let's perform a direct replace for toast to make sure it matches
    content = content.replace(old_toast, new_toast)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    print("Successfully optimized standalone superadmin dashboard page!")

if __name__ == "__main__":
    optimize()
