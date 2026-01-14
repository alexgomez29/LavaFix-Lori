import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Client, PaymentRecord, Notification } from '../types';
import { sendChatMessage } from '../services/geminiService';

const Dashboard = () => {
    // --- State ---
    const [activeTab, setActiveTab] = useState<'clientes' | 'pendientes' | 'historial' | 'notificaciones'>('clientes');
    
    // Search & Filters
    const [searchTerm, setSearchTerm] = useState('');
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
            console.error("Error loading clients", e);
            return [];
        }
    });

    const [payments, setPayments] = useState<PaymentRecord[]>(() => {
        try {
            const saved = localStorage.getItem('lavafix_payments');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Error loading payments", e);
            return [];
        }
    });

    const [notifications, setNotifications] = useState<Notification[]>(() => {
        try {
            const saved = localStorage.getItem('lavafix_notifications');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Error loading notifications", e);
            return [];
        }
    });

    // Persistence Effects
    useEffect(() => {
        localStorage.setItem('lavafix_clients', JSON.stringify(clients));
    }, [clients]);

    useEffect(() => {
        localStorage.setItem('lavafix_payments', JSON.stringify(payments));
    }, [payments]);

    useEffect(() => {
        localStorage.setItem('lavafix_notifications', JSON.stringify(notifications));
    }, [notifications]);

    // Chatbot State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Modal States
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
    
    const [currentClient, setCurrentClient] = useState<Partial<Client>>({});
    const [currentPayment, setCurrentPayment] = useState<Partial<PaymentRecord>>({});
    const [paymentNote, setPaymentNote] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Effects ---
    useEffect(() => {
        if (isChatOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, isChatOpen]);

    // --- Stats Calculations ---
    const totalClients = clients.length;
    const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);
    const pendingTotal = clients.filter(c => c.status === 'Pendiente').reduce((sum, c) => sum + c.monthlyAmount, 0);
    const pendingCount = clients.filter(c => c.status === 'Pendiente').length;

    // --- Data Processing & Filters ---

    // Filter Clients
    const filteredClients = clients.filter(client => {
        const term = searchTerm.toLowerCase();
        return (
            client.name.toLowerCase().includes(term) ||
            client.phone1.includes(term) ||
            (client.phone2 && client.phone2.includes(term))
        );
    });

    const getSortedClients = () => {
        let sorted = [...filteredClients];
        if (sortConfig.key === 'name') {
            sorted.sort((a, b) => {
                return sortConfig.direction === 'asc' 
                    ? a.name.localeCompare(b.name) 
                    : b.name.localeCompare(a.name);
            });
        } else if (sortConfig.key === 'status') {
             sorted.sort((a, b) => {
                if (a.status === b.status) return 0;
                if (sortConfig.direction === 'asc') return a.status === 'Pagado' ? -1 : 1;
                return a.status === 'Pagado' ? 1 : -1;
            });
        } else {
            // Default: Insertion Order (createdAt)
            sorted.sort((a, b) => a.createdAt - b.createdAt);
        }
        return sorted;
    };

    // Filter History
    const filteredPayments = payments.filter(p => {
        const matchesSearch = p.clientName.toLowerCase().includes(historySearch.toLowerCase());
        const pDate = new Date(p.date);
        const matchesYear = historyYear === 'all' || pDate.getFullYear().toString() === historyYear;
        const matchesMonth = historyMonth === 'all' || (pDate.getMonth() + 1).toString() === historyMonth;
        return matchesSearch && matchesYear && matchesMonth;
    });

    // --- Actions ---

    const handleSort = (key: 'name' | 'status') => {
        setSortConfig(current => {
            if (current.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setCurrentClient(prev => ({ ...prev, image: ev.target?.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveClient = () => {
        if (!currentClient.name || !currentClient.phone1) return;

        if (currentClient.id) {
            setClients(prev => prev.map(c => c.id === currentClient.id ? { ...c, ...currentClient } as Client : c));
            addNotification('Cliente Actualizado', `Se actualizaron los datos de ${currentClient.name}`, 'info');
        } else {
            const newClient: Client = {
                id: Math.random().toString(36).substr(2, 9),
                name: currentClient.name!,
                phone1: currentClient.phone1!,
                phone2: currentClient.phone2 || '',
                monthlyAmount: currentClient.monthlyAmount || 150,
                status: 'Pendiente',
                createdAt: Date.now(),
                image: currentClient.image || ''
            };
            setClients(prev => [...prev, newClient]);
            addNotification('Nuevo Cliente', `${newClient.name} ha sido agregado.`, 'success');
        }
        setIsClientModalOpen(false);
        setCurrentClient({});
    };

    const handleDeleteClient = (id: string) => {
        // Updated warning message as requested
        if (confirm('Advertencia: Se borrará definitivamente por completo. ¿Desea continuar?')) {
            setClients(prev => prev.filter(c => c.id !== id));
            // Also delete associated payments to be thorough
            setPayments(prev => prev.filter(p => p.clientId !== id));
            addNotification('Cliente Eliminado', 'El cliente y sus datos han sido eliminados por completo.', 'warning');
        }
    };

    const openPaymentModal = (client: Client) => {
        setCurrentClient(client);
        setPaymentNote('');
        setIsPaymentModalOpen(true);
    };

    const handleProcessPayment = () => {
        if (!currentClient || !currentClient.id) return;

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

        addNotification('Pago Recibido', `Pago de Q${newPayment.amount} recibido de ${newPayment.clientName}.`, 'success');
        setIsPaymentModalOpen(false);
        setCurrentClient({});
    };

    const handleUndoPayment = (client: Client) => {
        const confirmMsg = `¿Desea corregir el estado de "${client.name}"?\n\nEsta acción:\n1. Cambiará el estado a PENDIENTE.\n2. Eliminará el registro de pago más reciente de este cliente.`;
        
        if (window.confirm(confirmMsg)) {
            setClients(prevClients => prevClients.map(c => 
                c.id === client.id 
                ? { ...c, status: 'Pendiente', lastPaymentDate: undefined } 
                : c
            ));

            setPayments(prevPayments => {
                const clientPayments = prevPayments.filter(p => p.clientId === client.id);
                if (clientPayments.length === 0) return prevPayments;
                clientPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const paymentToRemoveId = clientPayments[0].id;
                return prevPayments.filter(p => p.id !== paymentToRemoveId);
            });

            addNotification('Estado Corregido', `${client.name} ha vuelto a estado Pendiente.`, 'info');
        }
    };

    const handleResetMonth = () => {
        if (confirm('¿Reiniciar mes? Todos los clientes pasarán a estado "Pendiente".')) {
            setClients(prev => prev.map(c => ({ ...c, status: 'Pendiente' })));
            addNotification('Mes Reiniciado', 'Todos los estados han sido reseteados a Pendiente.', 'info');
        }
    };

    // --- History Editing ---
    const openEditPaymentModal = (payment: PaymentRecord) => {
        setCurrentPayment(payment);
        setIsEditPaymentModalOpen(true);
    };

    const handleSavePaymentEdit = () => {
        if (!currentPayment.id) return;
        setPayments(prev => prev.map(p => p.id === currentPayment.id ? { ...p, ...currentPayment } as PaymentRecord : p));
        setIsEditPaymentModalOpen(false);
        setCurrentPayment({});
        addNotification('Registro Actualizado', 'El historial de pago ha sido modificado.', 'info');
    };

    // --- History Deleting ---
    const handleDeletePayment = (id: string) => {
        if (confirm('¿Está seguro de que desea eliminar este registro del historial permanentemente?')) {
            setPayments(prev => prev.filter(p => p.id !== id));
            addNotification('Registro Eliminado', 'El registro ha sido eliminado del historial.', 'warning');
        }
    };

    // --- Backup Download ---
    const handleDownloadBackup = () => {
        const headers = ["ID", "Cliente", "Fecha", "Monto", "Notas"];
        const rows = payments.map(p => [
            p.id,
            `"${p.clientName}"`,
            new Date(p.date).toLocaleDateString(),
            p.amount,
            `"${p.notes || ''}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `LavaFix_Respaldo_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- WhatsApp Logic ---
    const getWhatsAppMessage = (name: string, amount: number) => {
        return `Estimado/a ${name},

Espero que se encuentre bien. Le escribo para recordarle amablemente que tiene un pago pendiente de Q${amount.toFixed(2)}.

Agradecemos su pronta atención a este asunto.

Para cualquier consulta o reporte de problemas, puede contactar a:
Alex Gómez
Teléfono: 37080233

¡Muchas gracias!`;
    };

    const handleSendWhatsApp = (client: Client) => {
        const message = getWhatsAppMessage(client.name, client.monthlyAmount);
        const phone = client.phone1.replace(/\D/g, ''); // Remove non-digits
        const url = `https://wa.me/502${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handleSendToAll = () => {
        const pendingClients = clients.filter(c => c.status === 'Pendiente');
        if (pendingClients.length === 0) {
            alert("No hay clientes pendientes.");
            return;
        }

        if (confirm(`Se enviará un recordatorio a ${pendingClients.length} clientes. Debido a restricciones del navegador, se abrirá WhatsApp para el primer cliente. Por favor proceda manualmente con los demás.`)) {
            // Open first one
            handleSendWhatsApp(pendingClients[0]);
        }
    };

    const addNotification = (title: string, message: string, type: 'info'|'success'|'warning') => {
        setNotifications(prev => [{ id: Date.now().toString(), title, message, type, timestamp: new Date().toISOString() }, ...prev]);
    };

    // --- Chatbot Logic ---
    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        
        const userMsg = chatInput;
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsChatLoading(true);

        try {
            const historyForApi = chatMessages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const response = await sendChatMessage(historyForApi, userMsg);
            setChatMessages(prev => [...prev, { role: 'model', text: response.text || "Lo siento, no tengo respuesta para eso." }]);
        } catch (error) {
            console.error(error);
            setChatMessages(prev => [...prev, { role: 'model', text: "Lo siento, hubo un error de conexión." }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // --- Render Helpers ---

    const renderClientRow = (client: Client, isPendingView = false) => (
        <div key={client.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-white dark:bg-[#152a26] rounded-xl mb-3 shadow-sm hover:shadow-md transition-shadow border border-transparent hover:border-primary/20">
            <div className="col-span-4 flex items-center gap-3">
                 {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {client.image ? (
                        <img src={client.image} alt={client.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="material-symbols-outlined text-primary text-xl">person</span>
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[#111817] dark:text-white truncate" title={client.name}>{client.name}</span>
                </div>
            </div>
            <div className="col-span-3 flex flex-col justify-center">
                <div className="flex items-center gap-1 text-sm text-[#608a83]">
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    {client.phone1}
                </div>
                {client.phone2 && (
                    <div className="flex items-center gap-1 text-sm text-[#608a83]">
                         <span className="material-symbols-outlined text-[14px]">call</span>
                        {client.phone2}
                    </div>
                )}
            </div>
            <div className="col-span-2 font-bold text-[#111817] dark:text-white">Q{client.monthlyAmount.toFixed(2)}</div>
            <div className="col-span-1">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${client.status === 'Pagado' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {client.status}
                </span>
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
                {client.status === 'Pendiente' ? (
                    <>
                         {isPendingView && (
                             <button onClick={() => handleSendWhatsApp(client)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Enviar WhatsApp">
                                <span className="material-symbols-outlined text-sm">chat</span>
                             </button>
                         )}
                        <button onClick={() => openPaymentModal(client)} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition-transform hover:scale-105" title="Registrar Pago">
                            <span className="material-symbols-outlined text-sm">payments</span>
                        </button>
                    </>
                ) : (
                     <button onClick={() => handleUndoPayment(client)} className="p-2 bg-orange-100 dark:bg-orange-900/20 text-orange-500 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/40 transition-colors border border-orange-200 dark:border-orange-800" title="Corregir (Deshacer Pago)">
                        <span className="material-symbols-outlined text-sm">undo</span>
                    </button>
                )}
                 {!isPendingView && (
                    <>
                        <button onClick={() => { setCurrentClient(client); setIsClientModalOpen(true); }} className="p-2 bg-gray-100 dark:bg-[#2a3e3b] text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar">
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onClick={() => handleDeleteClient(client.id)} className="p-2 bg-gray-100 dark:bg-[#2a3e3b] text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar">
                            <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </>
                 )}
            </div>
        </div>
    );

    const sortedClients = getSortedClients();

    return (
        <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-sans">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Header - Center Text Only (No Lamp/Logo) */}
                <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-[#152a26] border-b border-gray-100 dark:border-[#2a3e3b] shrink-0 z-10 relative">
                   <div className="w-10"></div> {/* Spacer for balance */}
                   
                   <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                         <span className="text-xl font-black text-[#111817] dark:text-white tracking-tight">LavaFix</span>
                   </div>

                   <div className="flex items-center gap-4">
                       <div className="h-10 w-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">L</div>
                   </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
                    
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white dark:bg-[#152a26] p-6 rounded-2xl shadow-sm border border-transparent hover:border-primary/20 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xs font-bold text-[#608a83] uppercase tracking-wide">Total de Clientes</h3>
                                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><span className="material-symbols-outlined">group</span></div>
                            </div>
                            <p className="text-3xl font-black text-[#111817] dark:text-white">{totalClients}</p>
                        </div>
                        <div className="bg-white dark:bg-[#152a26] p-6 rounded-2xl shadow-sm border border-transparent hover:border-primary/20 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xs font-bold text-[#608a83] uppercase tracking-wide">Ingresos Totales</h3>
                                <div className="bg-green-100 text-green-600 p-2 rounded-lg"><span className="material-symbols-outlined">attach_money</span></div>
                            </div>
                            <p className="text-3xl font-black text-[#111817] dark:text-white">Q{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="bg-white dark:bg-[#152a26] p-6 rounded-2xl shadow-sm border border-transparent hover:border-primary/20 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xs font-bold text-[#608a83] uppercase tracking-wide">Pagos Pendientes</h3>
                                <div className="bg-orange-100 text-orange-500 p-2 rounded-lg"><span className="material-symbols-outlined">schedule</span></div>
                            </div>
                            <p className="text-3xl font-black text-[#111817] dark:text-white">Q{pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex flex-wrap gap-4 mb-6 border-b border-gray-200 dark:border-[#2a3e3b] pb-2">
                        {[
                            { id: 'clientes', label: 'Clientes', icon: 'people' },
                            { id: 'pendientes', label: 'Pendientes', icon: 'pending_actions' },
                            { id: 'historial', label: 'Historial de Pagos', icon: 'history' },
                            { id: 'notificaciones', label: 'Notificaciones', icon: 'notifications' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === tab.id ? 'bg-primary text-[#111817] shadow-lg shadow-primary/20' : 'text-[#608a83] hover:bg-gray-100 dark:hover:bg-[#1e3631]'}`}
                            >
                                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="animate-fade-in">
                        {/* Tab: Clientes */}
                        {activeTab === 'clientes' && (
                            <>
                                <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 gap-4">
                                    <h2 className="text-xl font-bold dark:text-white">Lista de Clientes</h2>
                                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                        <div className="relative flex-1 md:w-64">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                                            <input 
                                                type="text" 
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Buscar cliente..." 
                                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1e3631] border border-gray-200 dark:border-[#2a3e3b] rounded-lg text-sm focus:ring-2 focus:ring-primary dark:text-white"
                                            />
                                        </div>
                                        <button onClick={handleResetMonth} className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-orange-500/20 hover:brightness-110 transition-all flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-sm">restart_alt</span> Reiniciar Mes
                                        </button>
                                    </div>
                                </div>
                                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-[#608a83] uppercase tracking-wider mb-2">
                                    <div className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => handleSort('name')}>
                                        Nombre
                                        <span className="material-symbols-outlined text-sm">
                                            {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                                        </span>
                                    </div>
                                    <div className="col-span-3">Teléfonos</div>
                                    <div className="col-span-2">Monto Mensual</div>
                                    <div className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => handleSort('status')}>
                                        Estado
                                        <span className="material-symbols-outlined text-sm">
                                            {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                                        </span>
                                    </div>
                                    <div className="col-span-2 text-right">Acciones</div>
                                </div>
                                <div>
                                    {sortedClients.map(client => renderClientRow(client))}
                                </div>
                            </>
                        )}

                        {/* Tab: Pendientes */}
                        {activeTab === 'pendientes' && (
                            <>
                                <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 gap-4">
                                    <h2 className="text-xl font-bold dark:text-white">Clientes Pendientes <span className="text-sm font-normal text-[#608a83] ml-2">({pendingCount} pendientes)</span></h2>
                                    <div className="flex gap-3">
                                        <button onClick={handleResetMonth} className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-orange-500/20 hover:brightness-110 transition-all flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">restart_alt</span> Reiniciar Mes
                                        </button>
                                        <button onClick={handleSendToAll} className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-green-500/20 hover:brightness-110 transition-all flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">send</span> Enviar a Todos
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    {clients.filter(c => c.status === 'Pendiente').length > 0 ? (
                                        clients.filter(c => c.status === 'Pendiente').map(client => renderClientRow(client, true))
                                    ) : (
                                        <div className="text-center py-20">
                                            <div className="inline-flex p-4 bg-green-100 rounded-full text-green-500 mb-4"><span className="material-symbols-outlined text-4xl">check_circle</span></div>
                                            <p className="font-bold text-[#111817] dark:text-white">¡Todo al día!</p>
                                            <p className="text-sm text-[#608a83]">No hay clientes pendientes de pago.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Tab: Historial */}
                        {activeTab === 'historial' && (
                            <>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                    <h2 className="text-xl font-bold dark:text-white">Historial de Transacciones</h2>
                                    <button onClick={handleDownloadBackup} className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg font-bold text-sm shadow-lg shadow-[#7c3aed]/20 hover:brightness-110 transition-all flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">download</span> Descargar Respaldo
                                    </button>
                                </div>
                                
                                {/* History Filters */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-white dark:bg-[#152a26] rounded-xl shadow-sm">
                                    <div>
                                        <label className="text-xs font-bold text-[#608a83] uppercase mb-1 block">Buscar Cliente</label>
                                        <input 
                                            type="text" 
                                            value={historySearch} 
                                            onChange={(e) => setHistorySearch(e.target.value)}
                                            className="w-full bg-[#f0f5f4] dark:bg-[#1e3631] border-none rounded-lg p-2 text-sm dark:text-white" 
                                            placeholder="Nombre..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#608a83] uppercase mb-1 block">Año</label>
                                        <select 
                                            value={historyYear}
                                            onChange={(e) => setHistoryYear(e.target.value)}
                                            className="w-full bg-[#f0f5f4] dark:bg-[#1e3631] border-none rounded-lg p-2 text-sm dark:text-white"
                                        >
                                            <option value="all">Todos</option>
                                            <option value="2024">2024</option>
                                            <option value="2025">2025</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#608a83] uppercase mb-1 block">Mes</label>
                                        <select 
                                            value={historyMonth}
                                            onChange={(e) => setHistoryMonth(e.target.value)}
                                            className="w-full bg-[#f0f5f4] dark:bg-[#1e3631] border-none rounded-lg p-2 text-sm dark:text-white"
                                        >
                                            <option value="all">Todos</option>
                                            {Array.from({length: 12}, (_, i) => (
                                                <option key={i} value={(i + 1).toString()}>{new Date(0, i).toLocaleString('es', {month: 'long'})}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-[#152a26] rounded-xl shadow-sm overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-[#1e3631] border-b border-gray-100 dark:border-[#2a3e3b]">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-[#608a83] uppercase">Cliente</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-[#608a83] uppercase">Fecha</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-[#608a83] uppercase">Monto</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-[#608a83] uppercase">Notas</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-[#608a83] uppercase">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-[#2a3e3b]">
                                            {filteredPayments.map(payment => (
                                                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-[#1e3631] transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-[#111817] dark:text-white text-sm">{payment.clientName}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-[#608a83]">
                                                        {new Date(payment.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-green-600">Q{payment.amount.toFixed(2)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-[#608a83] italic">
                                                        {payment.notes || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 flex gap-2">
                                                        <button 
                                                            onClick={() => openEditPaymentModal(payment)}
                                                            className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                                                            title="Editar Registro"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeletePayment(payment.id)}
                                                            className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                                            title="Borrar Registro"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* Tab: Notificaciones */}
                        {activeTab === 'notificaciones' && (
                            <div className="space-y-4 max-w-2xl">
                                {notifications.map(notif => (
                                    <div key={notif.id} className={`p-4 rounded-xl border-l-4 shadow-sm bg-white dark:bg-[#152a26] flex gap-4 ${notif.type === 'success' ? 'border-green-500' : notif.type === 'warning' ? 'border-orange-500' : 'border-blue-500'}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notif.type === 'success' ? 'bg-green-100 text-green-600' : notif.type === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                            <span className="material-symbols-outlined">{notif.type === 'success' ? 'check' : notif.type === 'warning' ? 'priority_high' : 'info'}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[#111817] dark:text-white">{notif.title}</h4>
                                            <p className="text-sm text-[#608a83]">{notif.message}</p>
                                            <p className="text-xs text-gray-400 mt-1">{new Date(notif.timestamp).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- CHATBOT UI --- */}
                
                {/* Chat Window */}
                {isChatOpen && (
                    <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-48px)] h-[500px] max-h-[60vh] bg-white dark:bg-[#152a26] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#2a3e3b] z-50 animate-fade-in-up">
                        {/* Chat Header */}
                        <div className="p-4 bg-primary text-[#111817] flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined">smart_toy</span>
                                <h3 className="font-bold">Asistente LavaFix</h3>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className="hover:bg-black/10 rounded-full p-1 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>
                        
                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background-light dark:bg-[#10221f]">
                            {chatMessages.length === 0 && (
                                <div className="text-center text-[#608a83] text-sm mt-10">
                                    <span className="material-symbols-outlined text-4xl mb-2">chat</span>
                                    <p>¡Hola! ¿En qué puedo ayudarte hoy?</p>
                                </div>
                            )}
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                                        msg.role === 'user' 
                                            ? 'bg-primary text-[#111817] rounded-br-none' 
                                            : 'bg-white dark:bg-[#1e3a36] dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isChatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-[#1e3a36] p-3 rounded-xl rounded-bl-none shadow-sm border border-gray-200 dark:border-gray-700">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input */}
                        <form onSubmit={handleChatSubmit} className="p-3 bg-white dark:bg-[#152a26] border-t border-[#2a3e3b] flex gap-2 shrink-0">
                            <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Escribe tu consulta..."
                                className="flex-1 bg-[#f0f5f4] dark:bg-[#1e3631] border-none rounded-lg px-3 py-2 text-sm dark:text-white focus:ring-1 focus:ring-primary outline-none"
                            />
                            <button 
                                type="submit" 
                                disabled={!chatInput.trim() || isChatLoading}
                                className={`p-2 rounded-lg bg-primary text-[#111817] hover:brightness-110 transition-all ${(!chatInput.trim() || isChatLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span className="material-symbols-outlined text-xl">send</span>
                            </button>
                        </form>
                    </div>
                )}


                {/* --- MODALS --- */}

                {/* New Client Modal */}
                {isClientModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-[#152a26] rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-100">
                            <h3 className="text-xl font-bold mb-6 dark:text-white">{currentClient.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                            <div className="space-y-4">
                                <div className="flex justify-center mb-4">
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-24 h-24 rounded-full bg-[#f0f5f4] dark:bg-[#1e3a36] border-2 border-dashed border-[#608a83] flex items-center justify-center cursor-pointer hover:border-primary overflow-hidden relative group"
                                    >
                                        {currentClient.image ? (
                                            <img src={currentClient.image} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-symbols-outlined text-3xl text-[#608a83]">add_a_photo</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                             <span className="material-symbols-outlined text-white">edit</span>
                                        </div>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#608a83] uppercase mb-1">Nombre Completo</label>
                                    <input value={currentClient.name || ''} onChange={e => setCurrentClient({...currentClient, name: e.target.value})} type="text" className="w-full bg-[#f0f5f4] dark:bg-[#1e3131] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary dark:text-white" placeholder="Ej. Juan Pérez"/>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-[#608a83] uppercase mb-1">Teléfono 1</label>
                                        <input value={currentClient.phone1 || ''} onChange={e => setCurrentClient({...currentClient, phone1: e.target.value})} type="text" className="w-full bg-[#f0f5f4] dark:bg-[#1e3131] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary dark:text-white" placeholder="5555-5555"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[#608a83] uppercase mb-1">Teléfono 2 (Opcional)</label>
                                        <input value={currentClient.phone2 || ''} onChange={e => setCurrentClient({...currentClient, phone2: e.target.value})} type="text" className="w-full bg-[#f0f5f4] dark:bg-[#1e3131] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary dark:text-white" placeholder="4444-4444"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#608a83] uppercase mb-1">Monto Mensual (Q)</label>
                                    <input value={currentClient.monthlyAmount || ''} onChange={e => setCurrentClient({...currentClient, monthlyAmount: Number(e.target.value)})} type="number" className="w-full bg-[#f0f5f4] dark:bg-[#1e3131] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary dark:text-white" placeholder="150.00"/>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button onClick={() => setIsClientModalOpen(false)} className="flex-1 py-3 text-[#608a83] font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                                <button onClick={handleSaveClient} className="flex-1 py-3 bg-primary text-[#111817] font-bold rounded-xl hover:brightness-110 shadow-lg shadow-primary/20 transition-all">Guardar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Modal */}
                {isPaymentModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-[#152a26] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl">payments</span>
                                </div>
                                <h3 className="text-xl font-bold dark:text-white">Registrar Pago</h3>
                                <p className="text-sm text-[#608a83] mt-1">{currentClient.name}</p>
                            </div>
                            
                            <div className="bg-[#f8fafb] dark:bg-[#1e3631] p-4 rounded-xl mb-4 text-center">
                                <p className="text-xs font-bold text-[#608a83] uppercase">Monto a Pagar</p>
                                <p className="text-3xl font-black text-blue-600 mt-1">Q{currentClient.monthlyAmount?.toFixed(2)}</p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-[#608a83] uppercase mb-1">Notas del Pago (Opcional)</label>
                                <textarea value={paymentNote} onChange={e => setPaymentNote(e.target.value)} className="w-full bg-[#f0f5f4] dark:bg-[#1e3631] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary dark:text-white h-24 resize-none" placeholder="Ej. Pago adelantado, efectivo..."></textarea>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-[#608a83] font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                                <button onClick={handleProcessPayment} className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition-all">Confirmar Pago</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit History Payment Modal */}
                {isEditPaymentModalOpen && (
                     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-[#152a26] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <h3 className="text-xl font-bold mb-6 dark:text-white">Editar Registro de Pago</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#608a83] uppercase mb-1">Fecha</label>
                                    <input 
                                        type="datetime-local" 
                                        value={currentPayment.date ? currentPayment.date.slice(0, 16) : ''}
                                        onChange={e => setCurrentPayment({...currentPayment, date: new Date(e.target.value).toISOString()})}
                                        className="w-full bg-[#f0f5f4] dark:bg-[#1e3631] border-none rounded-lg p-3 text-sm dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#608a83] uppercase mb-1">Monto (Q)</label>
                                    <input 
                                        type="number"
                                        value={currentPayment.amount}
                                        onChange={e => setCurrentPayment({...currentPayment, amount: Number(e.target.value)})}
                                        className="w-full bg-[#f0f5f4] dark:bg-[#1e3631] border-none rounded-lg p-3 text-sm dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#608a83] uppercase mb-1">Notas</label>
                                    <textarea 
                                        value={currentPayment.notes || ''}
                                        onChange={e => setCurrentPayment({...currentPayment, notes: e.target.value})}
                                        className="w-full bg-[#f0f5f4] dark:bg-[#1e3631] border-none rounded-lg p-3 text-sm dark:text-white h-24 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setIsEditPaymentModalOpen(false)} className="flex-1 py-3 text-[#608a83] font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                                <button onClick={handleSavePaymentEdit} className="flex-1 py-3 bg-primary text-[#111817] font-bold rounded-xl hover:brightness-110 shadow-lg shadow-primary/20 transition-all">Guardar Cambios</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Floating Action Buttons */}
                <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-4 items-end">
                    {/* New Client Button */}
                    <button onClick={() => { setCurrentClient({}); setIsClientModalOpen(true); }} className="w-12 h-12 bg-white dark:bg-[#2a3e3b] text-[#608a83] rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform" title="Nuevo Cliente">
                        <span className="material-symbols-outlined text-2xl">person_add</span>
                    </button>
                    
                    {/* Chatbot Button */}
                    <button onClick={() => setIsChatOpen(!isChatOpen)} className="w-14 h-14 bg-primary text-[#111817] rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 transition-transform" title="Asistente IA">
                        <span className="material-symbols-outlined text-3xl">{isChatOpen ? 'close' : 'smart_toy'}</span>
                    </button>
                </div>

            </main>
        </div>
    );
};

export default Dashboard;