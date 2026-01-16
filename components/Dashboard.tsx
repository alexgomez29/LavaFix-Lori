import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Client, PaymentRecord, Notification } from '../types';

const Dashboard = () => {
    // --- State ---
    const [activeTab, setActiveTab] = useState<'clientes' | 'pendientes' | 'historial' | 'notificaciones'>('clientes');
    
    // Search & Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingSearchTerm, setPendingSearchTerm] = useState(''); // New search for Pending tab
    const [historySearch, setHistorySearch] = useState('');
    const [historyYear, setHistoryYear] = useState<string>('all');
    const [historyMonth, setHistoryMonth] = useState<string>('all');

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'status' | 'default', direction: 'asc' | 'desc' }>({ key: 'default', direction: 'asc' });

    // Data Init (LocalStorage Persistence)
    const [clients, setClients] = useState<Client[]>(() => {
        try {
            const saved = localStorage.getItem('lavafix_clients');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const [payments, setPayments] = useState<PaymentRecord[]>(() => {
        try {
            const saved = localStorage.getItem('lavafix_payments');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const [notifications, setNotifications] = useState<Notification[]>(() => {
        try {
            const saved = localStorage.getItem('lavafix_notifications');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    // Persistence Effects
    useEffect(() => { localStorage.setItem('lavafix_clients', JSON.stringify(clients)); }, [clients]);
    useEffect(() => { localStorage.setItem('lavafix_payments', JSON.stringify(payments)); }, [payments]);
    useEffect(() => { localStorage.setItem('lavafix_notifications', JSON.stringify(notifications)); }, [notifications]);

    // Modal States
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    
    const [currentClient, setCurrentClient] = useState<Partial<Client>>({});
    const [currentPayment, setCurrentPayment] = useState<Partial<PaymentRecord>>({});
    const [paymentNote, setPaymentNote] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Stats Calculations ---
    const totalClients = clients.length;
    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);
    const pendingTotal = clients.filter(c => c.status === 'Pendiente').reduce((sum, c) => sum + c.monthlyAmount, 0);
    const pendingCount = clients.filter(c => c.status === 'Pendiente').length;

    // --- Data Processing & Filters ---
    
    // Client Tab Filter
    const filteredClients = clients.filter(client => {
        const term = searchTerm.toLowerCase();
        return (
            client.name.toLowerCase().includes(term) ||
            client.phone1.includes(term) ||
            (client.phone2 && client.phone2.includes(term))
        );
    });

    // Pending Tab Filter
    const filteredPendingClients = clients.filter(client => {
        if (client.status !== 'Pendiente') return false;
        const term = pendingSearchTerm.toLowerCase();
        return (
            client.name.toLowerCase().includes(term) ||
            client.phone1.includes(term) ||
            (client.phone2 && client.phone2.includes(term))
        );
    });

    const getSortedClients = () => {
        let sorted = [...filteredClients];
        if (sortConfig.key === 'name') {
            sorted.sort((a, b) => sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        } else if (sortConfig.key === 'status') {
             sorted.sort((a, b) => {
                if (a.status === b.status) return 0;
                if (sortConfig.direction === 'asc') return a.status === 'Pagado' ? -1 : 1;
                return a.status === 'Pagado' ? 1 : -1;
            });
        } else {
            sorted.sort((a, b) => a.createdAt - b.createdAt);
        }
        return sorted;
    };

    const filteredPayments = payments.filter(p => {
        const matchesSearch = p.clientName.toLowerCase().includes(historySearch.toLowerCase());
        const pDate = new Date(p.date);
        const matchesYear = historyYear === 'all' || pDate.getFullYear().toString() === historyYear;
        const matchesMonth = historyMonth === 'all' || (pDate.getMonth() + 1).toString() === historyMonth;
        return matchesSearch && matchesYear && matchesMonth;
    });

    // --- Actions ---
    const handleSort = (key: 'name' | 'status') => {
        setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setCurrentClient(prev => ({ ...prev, image: ev.target?.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSaveClient = () => {
        if (!currentClient.name || !currentClient.phone1) return;
        if (currentClient.id) {
            setClients(prev => prev.map(c => c.id === currentClient.id ? { ...c, ...currentClient } as Client : c));
            addNotification('Cliente Actualizado', `Datos de ${currentClient.name} actualizados.`, 'info');
        } else {
            const newClient: Client = {
                id: Math.random().toString(36).substr(2, 9),
                name: currentClient.name!,
                phone1: currentClient.phone1!,
                phone2: currentClient.phone2 || '',
                monthlyAmount: currentClient.monthlyAmount || 150,
                status: 'Pendiente',
                createdAt: Date.now(),
                image: currentClient.image || '',
                reminderSent: false
            };
            setClients(prev => [...prev, newClient]);
            addNotification('Nuevo Cliente', `${newClient.name} agregado.`, 'success');
        }
        setIsClientModalOpen(false);
        setCurrentClient({});
    };

    const handleDeleteClient = (id: string) => {
        if (confirm('Advertencia: Se borrará definitivamente por completo. ¿Desea continuar?')) {
            setClients(prev => prev.filter(c => c.id !== id));
            setPayments(prev => prev.filter(p => p.clientId !== id));
            addNotification('Cliente Eliminado', 'Datos eliminados permanentemente.', 'warning');
        }
    };

    const handleProcessPayment = () => {
        if (!currentClient || !currentClient.id) return;
        // When processing payment, reminderSent is irrelevant until next month, but we can keep it as is or reset it
        setClients(prev => prev.map(c => c.id === currentClient.id ? { ...c, status: 'Pagado', lastPaymentDate: new Date().toISOString() } : c));
        const newPayment: PaymentRecord = {
            id: Math.random().toString(36).substr(2, 9),
            clientId: currentClient.id,
            clientName: currentClient.name || 'Desconocido',
            amount: currentClient.monthlyAmount || 0,
            date: new Date().toISOString(),
            notes: paymentNote
        };
        setPayments(prev => [newPayment, ...prev]);
        addNotification('Pago Recibido', `Q${newPayment.amount} de ${newPayment.clientName}.`, 'success');
        setIsPaymentModalOpen(false);
        setCurrentClient({});
    };

    const handleUndoPayment = (client: Client) => {
        if (window.confirm(`¿Error: Revertir pago de "${client.name}" y volver a PENDIENTE?`)) {
            // Set client back to pending
            setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Pendiente', lastPaymentDate: undefined } : c));
            
            // Remove the most recent payment for this client
            setPayments(prev => {
                // Get payments for this client sorted by date (newest first)
                const clientPayments = prev.filter(p => p.clientId === client.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                if (clientPayments.length === 0) return prev;
                
                // Identify the ID of the most recent payment to delete
                const paymentToDeleteId = clientPayments[0].id;
                
                // Return all payments EXCEPT the one we are deleting
                return prev.filter(p => p.id !== paymentToDeleteId);
            });
            addNotification('Corrección Realizada', `Pago revertido. ${client.name} está Pendiente.`, 'info');
        }
    };

    const handleResetMonth = () => {
        setIsResetModalOpen(true);
    };

    const confirmResetMonth = () => {
        setClients(prev => prev.map(c => ({ ...c, status: 'Pendiente', reminderSent: false })));
        setPayments([]); // Clear payments history for the new month cycle
        addNotification('Mes Reiniciado', 'Contadores a cero y estados reseteados.', 'info');
        setIsResetModalOpen(false);
    };

    const handleToggleReminder = (client: Client) => {
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, reminderSent: !c.reminderSent } : c));
    };

    const handleSavePaymentEdit = () => {
        if (!currentPayment.id) return;
        setPayments(prev => prev.map(p => p.id === currentPayment.id ? { ...p, ...currentPayment } as PaymentRecord : p));
        setIsEditPaymentModalOpen(false);
        setCurrentPayment({});
        addNotification('Historial Actualizado', 'Registro modificado.', 'info');
    };

    const handleDeletePayment = (id: string) => {
        if (confirm('¿Eliminar registro permanentemente?')) {
            setPayments(prev => prev.filter(p => p.id !== id));
            addNotification('Registro Eliminado', 'Registro borrado del historial.', 'warning');
        }
    };

    const handleDownloadBackup = () => {
        const headers = ["ID", "Cliente", "Fecha", "Monto", "Notas"];
        const rows = payments.map(p => [p.id, `"${p.clientName}"`, new Date(p.date).toLocaleDateString(), p.amount, `"${p.notes || ''}"`]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `LavaFix_Respaldo_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendWhatsApp = (client: Client) => {
        const message = `Estimado/a ${client.name},\nRecordatorio de pago pendiente: Q${client.monthlyAmount.toFixed(2)}.\n\nAtte: Alex Gómez\nLavaFix`;
        
        // Auto-check the reminder box when sending whatsapp
        if(!client.reminderSent) {
            handleToggleReminder(client);
        }
        
        // Send to Phone 1
        if (client.phone1) {
            window.open(`https://wa.me/502${client.phone1.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
        }

        // Send to Phone 2 if exists
        if (client.phone2 && client.phone2.trim() !== '') {
            setTimeout(() => {
                 window.open(`https://wa.me/502${client.phone2!.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
            }, 500);
        }
    };

    const handleSendToAll = () => {
        const pending = clients.filter(c => c.status === 'Pendiente');
        if (pending.length === 0) return alert("No hay pendientes.");
        if (confirm(`Se enviará mensaje al primero de ${pending.length} clientes.`)) handleSendWhatsApp(pending[0]);
    };

    const addNotification = (title: string, message: string, type: 'info'|'success'|'warning') => {
        setNotifications(prev => [{ id: Date.now().toString(), title, message, type, timestamp: new Date().toISOString() }, ...prev]);
    };

    const sortedClients = getSortedClients();

    // --- Components ---
    const StatCard = ({ title, value, icon, gradient }: any) => (
        <div className={`p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 ${gradient}`}>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-colors"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-80">{title}</h3>
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><span className="material-symbols-outlined">{icon}</span></div>
            </div>
            <p className="text-4xl font-black tracking-tight relative z-10">{value}</p>
        </div>
    );

    const renderClientRow = (client: Client, isPendingView = false) => (
        <div key={client.id} className="glass dark:border-slate-700/50 p-4 rounded-2xl mb-3 flex flex-col md:grid md:grid-cols-12 gap-4 items-center hover:shadow-glow transition-all duration-300 group">
            <div className="col-span-4 flex items-center gap-4 w-full">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary p-[2px] shadow-lg shrink-0">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-800">
                        {client.image ? <img src={client.image} alt={client.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-primary"><span className="material-symbols-outlined">person</span></div>}
                    </div>
                </div>
                <div className="min-w-0">
                    <span className="font-bold text-slate-800 dark:text-white text-lg block truncate">{client.name}</span>
                    {/* ID Hidden */}
                </div>
            </div>
            
            {/* Conditional Rendering for Pending vs Normal View Columns */}
            {isPendingView ? (
                <>
                    <div className="col-span-3 flex flex-col items-start w-full md:w-auto gap-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                            <span className="material-symbols-outlined text-sm">call</span>
                            {client.phone1}
                        </div>
                        {client.phone2 && (
                             <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                <span className="material-symbols-outlined text-sm">call</span>
                                {client.phone2}
                            </div>
                        )}
                    </div>
                    {/* Checkbox Column for Pending */}
                    <div className="col-span-2 flex items-center justify-center w-full md:w-auto">
                         <button 
                            onClick={() => handleToggleReminder(client)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                client.reminderSent 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-1 ring-green-500/50' 
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                         >
                             <span className="material-symbols-outlined text-lg">
                                 {client.reminderSent ? 'check_box' : 'check_box_outline_blank'}
                             </span>
                             {client.reminderSent ? 'Enviado' : 'Pendiente'}
                         </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="col-span-3 flex flex-col items-start w-full md:w-auto gap-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                            <span className="material-symbols-outlined text-sm">call</span>
                            {client.phone1}
                        </div>
                        {client.phone2 && (
                             <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                <span className="material-symbols-outlined text-sm">call</span>
                                {client.phone2}
                            </div>
                        )}
                    </div>
                    <div className="col-span-2 font-bold text-slate-800 dark:text-white text-lg w-full md:w-auto">Q{client.monthlyAmount.toFixed(2)}</div>
                    <div className="col-span-1 w-full md:w-auto">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-sm inline-flex items-center gap-1 ${client.status === 'Pagado' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'}`}>
                            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                            {client.status}
                        </span>
                    </div>
                </>
            )}

            <div className={`col-span-${isPendingView ? '3' : '2'} flex gap-2 justify-end w-full md:w-auto`}>
                {client.status === 'Pendiente' ? (
                    <>
                        {isPendingView && <button onClick={() => handleSendWhatsApp(client)} className="p-2 bg-green-500 text-white rounded-xl hover:bg-green-600 shadow-lg shadow-green-500/30 transition-transform hover:-translate-y-1"><span className="material-symbols-outlined text-sm">chat</span></button>}
                        <button onClick={() => { setCurrentClient(client); setPaymentNote(''); setIsPaymentModalOpen(true); }} className="px-4 py-2 bg-gradient-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/30 hover:brightness-110 transition-transform hover:-translate-y-1 flex items-center gap-2"><span className="material-symbols-outlined text-sm">payments</span> Pagar</button>
                    </>
                ) : (
                    <button onClick={() => handleUndoPayment(client)} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-xl hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors shadow-sm" title="Revertir a Pendiente - Corregir Error">
                        <span className="material-symbols-outlined text-sm">undo</span>
                    </button>
                )}
                {!isPendingView && (
                    <>
                        <button onClick={() => { setCurrentClient(client); setIsClientModalOpen(true); }} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-primary rounded-xl transition-colors"><span className="material-symbols-outlined text-sm">edit</span></button>
                        <button onClick={() => handleDeleteClient(client.id)} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-rose-500 rounded-xl transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden bg-light-bg dark:bg-dark-bg font-sans text-slate-800 dark:text-slate-100">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden relative z-10">
                {/* Modern Header */}
                <header className="h-20 flex items-center justify-between px-8 glass-panel shrink-0 z-20">
                   <div className="flex flex-col">
                       <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">LavaFix</h2>
                       <p className="text-xs text-slate-500 dark:text-slate-400">Bienvenido de nuevo, Admin</p>
                   </div>
                   <div className="flex items-center gap-4">
                       <div className="h-10 w-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-primary/30">L</div>
                   </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth space-y-8">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Total Clientes" value={totalClients} icon="group" gradient="bg-gradient-primary" />
                        <StatCard title="Ingresos Totales" value={`Q${totalIncome.toLocaleString()}`} icon="attach_money" gradient="bg-gradient-success" />
                        <StatCard title="Pendientes" value={`Q${pendingTotal.toLocaleString()}`} icon="pending_actions" gradient="bg-gradient-warning" />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-2xl w-fit backdrop-blur-sm">
                        {[
                            { id: 'clientes', label: 'Clientes', icon: 'people' },
                            { id: 'pendientes', label: 'Pendientes', icon: 'hourglass_top' },
                            { id: 'historial', label: 'Historial', icon: 'history' },
                            { id: 'notificaciones', label: 'Avisos', icon: 'notifications' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="animate-float" style={{ animationDuration: '0s' }}> 
                        {activeTab === 'clientes' && (
                            <>
                                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                                    <div className="relative group flex-1 max-w-md">
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                        <div className="relative bg-white dark:bg-slate-800 rounded-xl flex items-center px-4 py-3 border border-slate-200 dark:border-slate-700">
                                            <span className="material-symbols-outlined text-slate-400 mr-3">search</span>
                                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar cliente..." className="bg-transparent border-none outline-none text-sm w-full dark:text-white placeholder:text-slate-400" />
                                        </div>
                                    </div>
                                    <button onClick={handleResetMonth} className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-orange-500 font-bold rounded-xl hover:bg-orange-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 border border-orange-200 dark:border-orange-900/30"><span className="material-symbols-outlined text-sm">restart_alt</span> Reiniciar Mes</button>
                                </div>
                                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    <div onClick={() => handleSort('name')} className="col-span-4 cursor-pointer hover:text-primary flex items-center gap-1">Nombre <span className="material-symbols-outlined text-xs">sort</span></div>
                                    <div className="col-span-3">Teléfonos</div>
                                    <div className="col-span-2">Mensualidad</div>
                                    <div onClick={() => handleSort('status')} className="col-span-1 cursor-pointer hover:text-primary flex items-center gap-1">Estado <span className="material-symbols-outlined text-xs">sort</span></div>
                                    <div className="col-span-2 text-right">Acciones</div>
                                </div>
                                <div>{sortedClients.map(client => renderClientRow(client))}</div>
                            </>
                        )}

                        {activeTab === 'pendientes' && (
                            <>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                    <div className="flex flex-col">
                                        <h2 className="text-2xl font-bold dark:text-white">Pendientes de Pago</h2>
                                        <p className="text-xs text-slate-500">{pendingCount} clientes pendientes</p>
                                    </div>
                                    
                                    <div className="flex gap-3 w-full md:w-auto items-center">
                                        {/* Pending Search */}
                                        <div className="relative group max-w-xs w-full">
                                             <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                             <div className="relative bg-white dark:bg-slate-800 rounded-xl flex items-center px-4 py-2 border border-slate-200 dark:border-slate-700">
                                                 <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
                                                 <input 
                                                    type="text" 
                                                    value={pendingSearchTerm} 
                                                    onChange={(e) => setPendingSearchTerm(e.target.value)} 
                                                    placeholder="Buscar en pendientes..." 
                                                    className="bg-transparent border-none outline-none text-sm w-full dark:text-white placeholder:text-slate-400" 
                                                />
                                             </div>
                                        </div>

                                        <button onClick={handleSendToAll} className="px-5 py-2 bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-500/30 hover:bg-green-600 transition-transform hover:-translate-y-1 flex items-center gap-2"><span className="material-symbols-outlined">send</span></button>
                                    </div>
                                </div>
                                
                                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    <div className="col-span-4">Nombre</div>
                                    <div className="col-span-3">Teléfonos</div>
                                    <div className="col-span-2 text-center">Recordatorio</div>
                                    <div className="col-span-3 text-right">Acciones</div>
                                </div>

                                {filteredPendingClients.length > 0 ? filteredPendingClients.map(c => renderClientRow(c, true)) : (
                                    <div className="text-center py-20 opacity-50"><span className="material-symbols-outlined text-6xl mb-4 text-green-500">check_circle</span><p className="text-xl font-bold">¡Todo al día!</p></div>
                                )}
                            </>
                        )}
                        
                        {activeTab === 'historial' && (
                           <div className="glass rounded-2xl p-6">
                               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                   <h3 className="text-xl font-bold dark:text-white">Transacciones Recientes</h3>
                                   <button onClick={handleDownloadBackup} className="text-primary font-bold hover:underline flex items-center gap-1"><span className="material-symbols-outlined">download</span> CSV</button>
                               </div>

                               {/* History Filters */}
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                   <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-700">
                                       <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Cliente</label>
                                       <input 
                                            type="text" 
                                            value={historySearch} 
                                            onChange={(e) => setHistorySearch(e.target.value)} 
                                            placeholder="Nombre..."
                                            className="w-full bg-transparent border-none outline-none text-sm dark:text-white"
                                       />
                                   </div>
                                   <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-700">
                                       <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Año</label>
                                       <select value={historyYear} onChange={(e) => setHistoryYear(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm dark:text-white p-0">
                                           <option value="all">Todos</option>
                                           <option value="2024">2024</option>
                                           <option value="2025">2025</option>
                                       </select>
                                   </div>
                                   <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-700">
                                       <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Mes</label>
                                       <select value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm dark:text-white p-0">
                                            <option value="all">Todos</option>
                                            {Array.from({length: 12}, (_, i) => (
                                                <option key={i} value={(i + 1).toString()}>{new Date(0, i).toLocaleString('es', {month: 'long'})}</option>
                                            ))}
                                       </select>
                                   </div>
                               </div>

                               <div className="overflow-x-auto">
                                   <table className="w-full">
                                       <thead className="border-b border-slate-200 dark:border-slate-700">
                                           <tr>
                                               <th className="text-left py-3 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                                               <th className="text-left py-3 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                                               <th className="text-left py-3 text-xs font-bold text-slate-500 uppercase">Monto</th>
                                               <th className="text-left py-3 text-xs font-bold text-slate-500 uppercase">Notas</th>
                                               <th className="text-right py-3 text-xs font-bold text-slate-500 uppercase">Acciones</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                           {filteredPayments.map(p => (
                                               <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                   <td className="py-4 font-bold text-slate-700 dark:text-slate-200">{p.clientName}</td>
                                                   <td className="py-4 text-sm text-slate-500">{new Date(p.date).toLocaleDateString()}</td>
                                                   <td className="py-4 text-green-500 font-bold">Q{p.amount.toFixed(2)}</td>
                                                   <td className="py-4 text-sm text-slate-500 italic max-w-xs truncate">{p.notes || '-'}</td>
                                                   <td className="py-4 text-right">
                                                       <button onClick={() => { setCurrentPayment(p); setIsEditPaymentModalOpen(true); }} className="text-primary hover:text-primary-dark mr-2 p-1 hover:bg-primary/10 rounded"><span className="material-symbols-outlined text-sm">edit</span></button>
                                                       <button onClick={() => handleDeletePayment(p.id)} className="text-rose-400 hover:text-rose-600 p-1 hover:bg-rose-500/10 rounded"><span className="material-symbols-outlined text-sm">delete</span></button>
                                                   </td>
                                               </tr>
                                           ))}
                                       </tbody>
                                   </table>
                               </div>
                           </div>
                        )}
                        
                        {activeTab === 'notificaciones' && (
                             <div className="space-y-4 max-w-2xl">
                                {notifications.map(n => (
                                    <div key={n.id} className="glass p-4 rounded-xl flex gap-4 items-start border-l-4 border-primary">
                                        <div className="mt-1 text-primary"><span className="material-symbols-outlined">{n.type === 'success' ? 'check_circle' : 'info'}</span></div>
                                        <div>
                                            <h4 className="font-bold dark:text-white">{n.title}</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{n.message}</p>
                                            <span className="text-xs text-slate-400 block mt-2">{new Date(n.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Floating Actions for Add Client Only */}
                <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
                     <button onClick={() => { setCurrentClient({}); setIsClientModalOpen(true); }} className="h-14 w-14 rounded-full bg-white dark:bg-slate-700 text-slate-500 shadow-xl flex items-center justify-center hover:scale-110 transition-transform hover:text-primary"><span className="material-symbols-outlined text-2xl">person_add</span></button>
                </div>

                {/* Modals */}
                {isClientModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-700/50">
                            <h3 className="text-2xl font-bold mb-6 text-gradient">{currentClient.id ? 'Editar' : 'Nuevo'} Cliente</h3>
                            <div className="space-y-4">
                                <div onClick={() => fileInputRef.current?.click()} className="h-24 w-24 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-primary/50 flex items-center justify-center cursor-pointer overflow-hidden relative group">
                                    {currentClient.image ? <img src={currentClient.image} className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-slate-400">add_a_photo</span>}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-white">edit</span></div>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                                <input value={currentClient.name||''} onChange={e=>setCurrentClient({...currentClient,name:e.target.value})} placeholder="Nombre Completo" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none dark:text-white" />
                                <div className="grid grid-cols-2 gap-4">
                                    <input value={currentClient.phone1||''} onChange={e=>setCurrentClient({...currentClient,phone1:e.target.value})} placeholder="Teléfono 1" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none dark:text-white" />
                                    <input value={currentClient.phone2||''} onChange={e=>setCurrentClient({...currentClient,phone2:e.target.value})} placeholder="Teléfono 2 (Opcional)" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none dark:text-white" />
                                </div>
                                <div>
                                    <input type="number" value={currentClient.monthlyAmount||''} onChange={e=>setCurrentClient({...currentClient,monthlyAmount:Number(e.target.value)})} placeholder="Q Monto Mensual" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none dark:text-white" />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button onClick={() => setIsClientModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Cancelar</button>
                                <button onClick={handleSaveClient} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:brightness-110">Guardar</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {isPaymentModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-700/50">
                            <div className="text-center mb-6">
                                <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><span className="material-symbols-outlined text-3xl">payments</span></div>
                                <h3 className="text-xl font-bold dark:text-white">Confirmar Pago</h3>
                                <p className="text-4xl font-black text-green-500 mt-2">Q{currentClient.monthlyAmount?.toFixed(2)}</p>
                            </div>
                            <textarea value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} placeholder="Notas (opcional)" className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none outline-none dark:text-white h-24 mb-6 resize-none" />
                            <div className="flex gap-3">
                                <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                                <button onClick={handleProcessPayment} className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/30">Confirmar</button>
                            </div>
                        </div>
                    </div>
                )}

                 {/* Edit History Payment Modal */}
                 {isEditPaymentModalOpen && (
                     <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-700/50">
                            <h3 className="text-xl font-bold mb-6 dark:text-white">Editar Registro</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                                    <input 
                                        type="datetime-local" 
                                        value={currentPayment.date ? currentPayment.date.slice(0, 16) : ''}
                                        onChange={e => setCurrentPayment({...currentPayment, date: new Date(e.target.value).toISOString()})}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 text-sm dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto (Q)</label>
                                    <input 
                                        type="number"
                                        value={currentPayment.amount}
                                        onChange={e => setCurrentPayment({...currentPayment, amount: Number(e.target.value)})}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 text-sm dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas</label>
                                    <textarea 
                                        value={currentPayment.notes || ''}
                                        onChange={e => setCurrentPayment({...currentPayment, notes: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 text-sm dark:text-white h-24 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setIsEditPaymentModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                                <button onClick={handleSavePaymentEdit} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-primary/20 transition-all">Guardar</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Verification Modal for Reset Month */}
                {isResetModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-700/50">
                            <div className="text-center mb-6">
                                <div className="h-16 w-16 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl">warning</span>
                                </div>
                                <h3 className="text-xl font-bold dark:text-white">¿Reiniciar Mes?</h3>
                                <p className="text-sm text-slate-500 mt-2">
                                    Esto borrará el historial de pagos actual para iniciar un nuevo ciclo y pondrá a todos en "Pendiente".
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsResetModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                                <button onClick={confirmResetMonth} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30">Confirmar</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;