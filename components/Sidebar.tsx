import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;
    
    const [isPinned, setIsPinned] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const isExpanded = isPinned || isHovered;

    return (
        <aside 
            className={`transition-all duration-300 border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-dark-surface/80 backdrop-blur-xl flex flex-col justify-between p-4 hidden md:flex z-20 shadow-2xl ${isExpanded ? 'w-64' : 'w-20'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between min-h-[3rem]">
                    <Link to="/" className="flex items-center gap-3 px-1 overflow-hidden group">
                        <div className={`flex flex-col transition-opacity duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                            <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">LavaFix</h1>
                        </div>
                    </Link>
                    
                    <div className={`flex items-center gap-1 ${!isExpanded ? 'flex-col gap-2' : ''}`}>
                        <button 
                            onClick={() => setIsPinned(!isPinned)}
                            className="text-slate-400 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={isPinned ? "Desanclar menú" : "Anclar menú"}
                        >
                            <span className="material-symbols-outlined text-xl">
                                {isPinned ? 'keep_public' : 'menu'}
                            </span>
                        </button>
                    </div>
                </div>

                <nav className="flex flex-col gap-2">
                    <NavItem 
                        to="/" 
                        icon="dashboard" 
                        label="Dashboard" 
                        active={isActive('/')} 
                        expanded={isExpanded} 
                    />
                    
                    <div className={`px-3 pt-6 pb-2 transition-opacity duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Técnico AI</p>
                    </div>
                    
                    {!isExpanded && <div className="h-px bg-slate-200 dark:bg-slate-700 mx-3 my-2"></div>}

                    <NavItem 
                        to="/diagnosis" 
                        icon="smart_toy" 
                        label="Diagnóstico IA" 
                        active={isActive('/diagnosis')} 
                        expanded={isExpanded} 
                    />
                    <NavItem 
                        to="/devices" 
                        icon="build_circle" 
                        label="Reparaciones" 
                        active={isActive('/devices')} 
                        expanded={isExpanded} 
                    />
                </nav>
            </div>
            
            <div className={`flex flex-col gap-4 transition-all duration-300 ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 hidden'}`}>
                <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-4 border border-primary/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-xl -mr-4 -mt-4"></div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white mb-1 uppercase tracking-wider relative z-10">Estado Premium</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 relative z-10">Gemini 1.5 Pro Activo</p>
                    <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-primary rounded-full"></div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

const NavItem = ({ to, icon, label, active, expanded }: any) => (
    <Link 
        to={to} 
        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
            active 
            ? 'bg-gradient-primary text-white shadow-lg shadow-primary/30' 
            : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
    >
        <span className={`material-symbols-outlined text-2xl shrink-0 z-10 ${active ? 'fill-icon' : ''}`}>{icon}</span>
        <p className={`text-sm font-semibold transition-opacity duration-200 whitespace-nowrap z-10 ${expanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>{label}</p>
    </Link>
);

export default Sidebar;