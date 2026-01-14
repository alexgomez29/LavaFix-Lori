import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;
    
    // Estado para controlar si el menú está fijo manualmente
    const [isPinned, setIsPinned] = useState(false);
    // Estado para hover
    const [isHovered, setIsHovered] = useState(false);

    const isExpanded = isPinned || isHovered;

    return (
        <aside 
            className={`transition-all duration-300 border-r border-[#dbe6e4] dark:border-[#2a3e3b] bg-white dark:bg-[#152a26] flex flex-col justify-between p-4 hidden md:flex z-20 shadow-xl ${isExpanded ? 'w-64' : 'w-20'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between min-h-[3rem]">
                    <Link to="/" className="flex items-center gap-3 px-1 overflow-hidden">
                        {/* TEXTO SOLO - Sin imagen/lampara */}
                        <div className={`flex flex-col transition-opacity duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                            <h1 className="text-[#111817] dark:text-white text-lg font-bold leading-none">LavaFix</h1>
                            <p className="text-[#608a83] text-xs font-normal">Gestión & IA</p>
                        </div>
                    </Link>
                    
                    {/* Botón Manual para fijar/ocultar menú */}
                    <button 
                        onClick={() => setIsPinned(!isPinned)}
                        className={`text-[#608a83] hover:text-primary transition-colors ${!isExpanded ? 'mx-auto' : ''}`}
                        title={isPinned ? "Desanclar menú" : "Anclar menú"}
                    >
                        <span className="material-symbols-outlined">
                            {isPinned ? 'push_pin' : 'menu'}
                        </span>
                    </button>
                </div>

                <nav className="flex flex-col gap-2">
                    <Link to="/" className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/') ? 'bg-primary/20 text-[#111817] dark:text-primary' : 'hover:bg-[#f0f5f4] dark:hover:bg-[#1e3631] text-[#608a83] dark:text-gray-400'}`}>
                        <span className={`material-symbols-outlined text-2xl shrink-0 ${isActive('/') ? 'fill-icon' : ''}`}>dashboard</span>
                        <p className={`text-sm font-semibold transition-opacity duration-200 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>Gestión Clientes</p>
                    </Link>
                    
                    <div className={`px-3 pt-4 pb-2 transition-opacity duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                        <p className="text-[10px] font-bold text-[#608a83] uppercase tracking-wider">Herramientas Técnico</p>
                    </div>
                    
                    {!isExpanded && <div className="h-px bg-gray-200 dark:bg-[#2a3e3b] mx-2"></div>}

                    <Link to="/diagnosis" className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/diagnosis') ? 'bg-primary/20 text-[#111817] dark:text-primary' : 'hover:bg-[#f0f5f4] dark:hover:bg-[#1e3631] text-[#608a83] dark:text-gray-400'}`}>
                        <span className="material-symbols-outlined text-2xl shrink-0">build</span>
                        <p className={`text-sm font-medium transition-opacity duration-200 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>Diagnóstico IA</p>
                    </Link>
                    <Link to="/devices" className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${isActive('/devices') ? 'bg-primary/20 text-[#111817] dark:text-primary' : 'hover:bg-[#f0f5f4] dark:hover:bg-[#1e3631] text-[#608a83] dark:text-gray-400'}`}>
                        <span className="material-symbols-outlined text-2xl shrink-0">kitchen</span>
                        <p className={`text-sm font-medium transition-opacity duration-200 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>Repuestos & Manuales</p>
                    </Link>
                </nav>
            </div>
            
            <div className={`flex flex-col gap-4 transition-opacity duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
                    <p className="text-xs font-bold text-[#111817] dark:text-white mb-1 uppercase">Plan Negocio</p>
                    <p className="text-[11px] text-[#608a83] mb-3">Gestión completa y soporte IA activo.</p>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;