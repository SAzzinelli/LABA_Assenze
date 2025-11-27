import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import AdminCreatePermissionModal from '../components/AdminCreatePermissionModal';
import { PermessiSkeleton } from '../components/Skeleton';
import { 
  FileText, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  Save,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  User,
  Search,
  UserPlus,
  MessageSquare,
  Timer
} from 'lucide-react';

const LeaveRequests = () => {
  const { user, apiCall } = useAuthStore();
  const { alert, showSuccess, showError, showConfirm, hideAlert } = useCustomAlert();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'uscita_anticipata', // USCITA ANTICIPATA o ENTRATA_POSTICIPATA
    permissionDate: '',
    exitTime: '', // Orario di uscita per uscita anticipata
    entryTime: '', // Orario di entrata per entrata posticipata
    notes: '',
    fullDay: false // Permesso per tutta la giornata
  });
  
  // Orario di lavoro reale per il calcolo corretto
  const [workSchedule, setWorkSchedule] = useState(null);
  const [fullDayHours, setFullDayHours] = useState(null);

  // Filtri temporali per admin
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Campo di ricerca
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stato per collassabile filtri
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Array vuoto per le richieste di permessi
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tab per admin
  const [activeTab, setActiveTab] = useState('imminenti'); // 'imminenti' | 'cronologia'
  
  // Stati per dialog di approvazione/rifiuto/annullamento/modifica
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRequestModificationDialog, setShowRequestModificationDialog] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [modificationRequest, setModificationRequest] = useState({
    reason: '',
    requestedChanges: ''
  });
  const [editFormData, setEditFormData] = useState({
    entryTime: '',
    exitTime: '',
    hours: ''
  });
  const [permissions104, setPermissions104] = useState({
    usedThisMonth: 0,
    maxPerMonth: 3,
    remaining: 3
  });

  // Hook per gestire chiusura modal con ESC e click fuori
  useModal(showNewRequest, () => setShowNewRequest(false));

  // Funzione per recuperare le richieste dal backend
  const fetchRequests = async () => {
    try {
      setLoading(true);
      // Filtra solo le richieste di tipo "permission" (permessi orari)
      const response = await apiCall('/api/leave-requests?type=permission');
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        console.error('Errore nel recupero delle richieste');
      }
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carica le richieste al mount
  useEffect(() => {
    fetchRequests();
  }, []);

  // Carica permessi 104 se l'utente li ha
  useEffect(() => {
    if (user?.has104) {
      fetchPermissions104();
    }
  }, [user?.has104]);

  // Carica l'orario di lavoro quando cambia la data del permesso
  useEffect(() => {
    const fetchWorkSchedule = async () => {
      if (!formData.permissionDate) {
        setWorkSchedule(null);
        setFullDayHours(null);
        return;
      }
      
      try {
        const date = new Date(formData.permissionDate);
        const dayOfWeek = date.getDay(); // 0 = Domenica, 1 = Lunedì, etc.
        
        const response = await apiCall('/api/work-schedules');
        if (response.ok) {
          const schedules = await response.json();
          // Trova l'orario per il giorno specifico
          const schedule = schedules.find(s => 
            s.day_of_week === dayOfWeek && s.is_working_day
          );
          
          if (schedule) {
            setWorkSchedule({
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              break_duration: schedule.break_duration !== null && schedule.break_duration !== undefined ? schedule.break_duration : 0,
              break_start_time: schedule.break_start_time || null
            });
          } else {
            setWorkSchedule(null);
            setFullDayHours(null);
          }
        }
      } catch (error) {
        console.error('Error fetching work schedule:', error);
        setWorkSchedule(null);
        setFullDayHours(null);
      }
    };
    
    fetchWorkSchedule();
  }, [formData.permissionDate, apiCall]);

  // Calcola le ore per permesso giornata completa quando cambiano fullDay, permissionDate o workSchedule
  useEffect(() => {
    if (formData.type === 'full_day' && formData.permissionDate && workSchedule) {
      try {
        const [startHour, startMin] = workSchedule.start_time.split(':').map(Number);
        const [endHour, endMin] = workSchedule.end_time.split(':').map(Number);
        // IMPORTANTE: usa break_duration dal database, non default 0 (se è 0, è 0!)
        const breakDuration = workSchedule.break_duration !== null && workSchedule.break_duration !== undefined ? workSchedule.break_duration : 0;
        
        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const workMinutes = Math.max(0, totalMinutes - breakDuration);
        const hours = workMinutes / 60;
        
        setFullDayHours(parseFloat(hours.toFixed(2)));
        console.log(`✅ Full day hours calculated: ${workSchedule.start_time}-${workSchedule.end_time}, break: ${breakDuration}min = ${hours.toFixed(2)}h`);
      } catch (error) {
        console.error('❌ Error calculating full day hours:', error);
        setFullDayHours(null);
      }
    } else if (formData.type !== 'full_day') {
      setFullDayHours(null);
    }
  }, [formData.type, formData.permissionDate, workSchedule]);

  const fetchPermissions104 = async () => {
    try {
      const response = await apiCall('/api/104-permissions/count');
      if (response.ok) {
        const data = await response.json();
        setPermissions104(data);
      }
    } catch (error) {
      console.error('Error fetching 104 permissions:', error);
    }
  };

  // Funzioni per gestire approvazione/rifiuto richieste (solo admin)
  const handleApproveRequest = async (requestId, notes = '') => {
    try {
      const response = await apiCall(`/api/leave-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'approved',
          notes: notes
        })
      });

      if (response.ok) {
        showSuccess('Richiesta approvata con successo');
        fetchRequests(); // Ricarica le richieste
      } else {
        const error = await response.json();
        showError(`Errore: ${error.error || 'Errore durante l\'approvazione'}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      showError('Errore durante l\'approvazione della richiesta');
    }
  };

  const handleRejectRequest = async (requestId, notes = '') => {
    try {
      const response = await apiCall(`/api/leave-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'rejected',
          notes: notes
        })
      });

      if (response.ok) {
        showSuccess('Richiesta rifiutata');
        fetchRequests(); // Ricarica le richieste
      } else {
        const error = await response.json();
        showError(`Errore: ${error.error || 'Errore durante il rifiuto'}`);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      showError('Errore durante il rifiuto della richiesta');
    }
  };

  // Funzioni per gestire i dialog
  const openApproveDialog = (requestId) => {
    setSelectedRequestId(requestId);
    setApprovalNotes('');
    setShowApproveDialog(true);
  };

  const openRejectDialog = (requestId) => {
    setSelectedRequestId(requestId);
    setRejectionNotes('');
    setShowRejectDialog(true);
  };

  const openCancelDialog = (requestId) => {
    setSelectedRequestId(requestId);
    setCancellationReason('');
    setShowCancelDialog(true);
  };

  const [editWorkSchedule, setEditWorkSchedule] = useState(null);
  const [calculatedHours, setCalculatedHours] = useState(null);

  const openEditDialog = async (request) => {
    setSelectedRequest(request);
    setSelectedRequestId(request.id);
    setEditFormData({
      entryTime: request.entryTime || request.entry_time || '',
      exitTime: request.exitTime || request.exit_time || '',
      hours: request.hours || ''
    });
    
    // Recupera l'orario di lavoro per la data del permesso
    const permissionDate = request.permissionDate || request.startDate || request.start_date;
    if (permissionDate) {
      try {
        const date = new Date(permissionDate);
        const dayOfWeek = date.getDay(); // 0 = Domenica, 1 = Lunedì, etc.
        
        // Se è un permesso di un dipendente specifico, recupera il suo orario
        const userId = request.userId || request.user_id;
        if (userId) {
          const response = await apiCall(`/api/employees`);
          if (response.ok) {
            const employees = await response.json();
            const employee = employees.find(emp => emp.id === userId);
            if (employee && employee.workSchedule) {
              const daySchedule = Object.entries(employee.workSchedule).find(([day, sched]) => {
                const dayMap = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
                return day === dayMap[dayOfWeek] && sched.active;
              });
              if (daySchedule && daySchedule[1]) {
                const schedule = daySchedule[1];
                setEditWorkSchedule({
                  start_time: schedule.startTime || schedule.start_time,
                  end_time: schedule.endTime || schedule.end_time
                });
              }
            }
          }
        } else {
          // Fallback: usa l'orario dell'utente corrente
          const response = await apiCall('/api/work-schedules');
          if (response.ok) {
            const schedules = await response.json();
            const schedule = schedules.find(s => 
              s.day_of_week === dayOfWeek && s.is_working_day
            );
            if (schedule) {
              setEditWorkSchedule({
                start_time: schedule.start_time,
                end_time: schedule.end_time
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching work schedule:', error);
      }
    }
    
    setShowEditDialog(true);
    
    // Calcola le ore iniziali dopo aver impostato lo schedule (con un piccolo delay per permettere lo stato di aggiornarsi)
    setTimeout(() => {
      calculateEditHours(request.entryTime || request.entry_time, request.exitTime || request.exit_time, request);
    }, 100);
  };
  
  const calculateEditHours = (entryTime, exitTime, request) => {
    // Se non abbiamo ancora lo schedule, proviamo a recuperarlo dal selectedRequest
    const scheduleToUse = editWorkSchedule || (selectedRequest && selectedRequest.workSchedule);
    if (!scheduleToUse) {
      // Non possiamo calcolare senza schedule, lascia null
      setCalculatedHours(null);
      return;
    }
    
    let calculated = null;
    
    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const startTime = scheduleToUse.start_time || scheduleToUse.startTime;
    const endTime = scheduleToUse.end_time || scheduleToUse.endTime;
    
    if ((request.permissionType === 'late_entry' || request.permissionType === 'entrata_posticipata' || request.entryTime) && entryTime && startTime) {
      // Entrata posticipata: ore = (entryTime - start_time) / 60
      const startMinutes = timeToMinutes(startTime);
      const entryMinutes = timeToMinutes(entryTime);
      calculated = Math.max(0, (entryMinutes - startMinutes) / 60);
    } else if ((request.permissionType === 'early_exit' || request.permissionType === 'uscita_anticipata' || request.exitTime) && exitTime && endTime) {
      // Uscita anticipata: ore = (end_time - exitTime) / 60
      const endMinutes = timeToMinutes(endTime);
      const exitMinutes = timeToMinutes(exitTime);
      calculated = Math.max(0, (endMinutes - exitMinutes) / 60);
    }
    
    setCalculatedHours(calculated);
  };

  const confirmApprove = () => {
    handleApproveRequest(selectedRequestId, approvalNotes);
    setShowApproveDialog(false);
  };

  const confirmReject = () => {
    handleRejectRequest(selectedRequestId, rejectionNotes);
    setShowRejectDialog(false);
  };

  const confirmCancel = () => {
    handleCancelRequest(selectedRequestId, cancellationReason);
    setShowCancelDialog(false);
  };

  const handleEditPermission = async () => {
    if (!selectedRequestId) return;
    
    try {
      const payload = {};
      let hasChanges = false;
      
      // Controlla se entryTime è cambiato
      const currentEntryTime = selectedRequest.entryTime || selectedRequest.entry_time || '';
      if (editFormData.entryTime !== currentEntryTime) {
        payload.entryTime = editFormData.entryTime;
        hasChanges = true;
      }
      
      // Controlla se exitTime è cambiato
      const currentExitTime = selectedRequest.exitTime || selectedRequest.exit_time || '';
      if (editFormData.exitTime !== currentExitTime) {
        payload.exitTime = editFormData.exitTime;
        hasChanges = true;
      }

      if (!hasChanges) {
        showError('Nessuna modifica da salvare');
        return;
      }

      // Non inviare hours: verrà calcolato automaticamente dal backend
      // in base all'orario di lavoro del dipendente

      const response = await apiCall(`/api/leave-requests/${selectedRequestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showSuccess('Permesso modificato con successo! Le ore sono state calcolate automaticamente.');
        fetchRequests();
        setShowEditDialog(false);
        setCalculatedHours(null);
        setEditWorkSchedule(null);
      } else {
        const error = await response.json();
        showError(`Errore: ${error.error || 'Errore durante la modifica'}`);
      }
    } catch (error) {
      console.error('Error editing permission:', error);
      showError('Errore durante la modifica del permesso');
    }
  };

  // Funzione per annullare richieste approvate (solo admin, solo permessi)
  // Richiedi modifica permesso approvato (dipendente)
  const handleRequestModification = async () => {
    try {
      if (!selectedRequest) return;

      if (!modificationRequest.reason || !modificationRequest.reason.trim()) {
        showError('Inserisci il motivo della richiesta di modifica');
        return;
      }

      const response = await apiCall('/api/leave-requests/request-modification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leaveRequestId: selectedRequest.id,
          reason: modificationRequest.reason,
          requestedChanges: modificationRequest.requestedChanges || ''
        })
      });

      if (response.ok) {
        showSuccess('Richiesta inviata!', 'La tua richiesta di modifica è stata inviata all\'amministratore. Riceverai una notifica quando verrà gestita.');
        setShowRequestModificationDialog(false);
        setSelectedRequest(null);
        setModificationRequest({ reason: '', requestedChanges: '' });
        fetchRequests(); // Ricarica le richieste
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Errore durante l\'invio della richiesta di modifica');
      }
    } catch (error) {
      console.error('Error requesting modification:', error);
      showError('Errore durante l\'invio della richiesta di modifica');
    }
  };

  const handleCancelRequest = async (requestId, reason = '') => {
    try {
      const { token } = useAuthStore.getState();
      
      if (!token) {
        showError('Token non trovato. Effettua il login.');
        return;
      }
      
      console.log('🔍 Cancelling request with token:', token.substring(0, 20) + '...');
      
      const response = await fetch(`/api/hours/admin/leave-requests/${requestId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason
        })
      });

      if (response.ok) {
        const data = await response.json();
        showSuccess('Richiesta annullata con successo!');
        fetchRequests(); // Ricarica le richieste
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Errore durante l\'annullamento della richiesta');
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      showError('Errore durante l\'annullamento della richiesta');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: newValue
      };
      
      // Se cambia type a full_day, resetta i campi tempo e imposta fullDay
      if (name === 'type') {
        if (value === 'full_day') {
          updated.fullDay = true;
          updated.exitTime = '';
          updated.entryTime = '';
        } else {
          updated.fullDay = false;
        }
      }
      
      return updated;
    });
  };

  // Calcola automaticamente le ore di permesso usando l'orario reale
  const calculatePermissionHours = () => {
    if (!formData.permissionDate) return 0;
    
    // Se abbiamo l'orario di lavoro per quel giorno, usalo
    if (workSchedule) {
      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      if (formData.type === 'uscita_anticipata' && formData.exitTime) {
        // Uscita anticipata: calcola le ore di lavoro perse da exitTime alla fine
        // IMPORTANTE: considera la pausa pranzo se l'uscita è prima o durante la pausa
        const exitMinutes = timeToMinutes(formData.exitTime);
        const standardEndMinutes = timeToMinutes(workSchedule.end_time);
        const breakDuration = workSchedule.break_duration !== null && workSchedule.break_duration !== undefined ? workSchedule.break_duration : 0;
        
        // Calcola l'inizio e fine della pausa pranzo
        let breakStartMinutes = null;
        let breakEndMinutes = null;
        
        if (breakDuration > 0 && workSchedule.break_start_time) {
          breakStartMinutes = timeToMinutes(workSchedule.break_start_time);
          breakEndMinutes = breakStartMinutes + breakDuration;
        } else if (breakDuration > 0) {
          // Se non c'è break_start_time, calcola la pausa a metà giornata
          const startMinutes = timeToMinutes(workSchedule.start_time);
          const totalMinutes = standardEndMinutes - startMinutes;
          breakStartMinutes = startMinutes + (totalMinutes / 2) - (breakDuration / 2);
          breakEndMinutes = breakStartMinutes + breakDuration;
        }
        
        // Calcola le ore di permesso
        let permissionMinutes = 0;
        
        if (exitMinutes <= breakStartMinutes) {
          // Esce prima della pausa: perde tutto il pomeriggio + pausa
          // Ore perse = (end - exit) - break_duration (perché la pausa non conta come lavoro)
          permissionMinutes = (standardEndMinutes - exitMinutes) - breakDuration;
        } else if (exitMinutes >= breakEndMinutes) {
          // Esce dopo la pausa: perde solo il pomeriggio rimanente
          permissionMinutes = standardEndMinutes - exitMinutes;
        } else {
          // Esce durante la pausa: perde la parte rimanente della pausa + tutto il pomeriggio
          // Ore perse = (end - break_start) - (exit - break_start) = end - exit
          permissionMinutes = standardEndMinutes - exitMinutes;
        }
        
        return Math.max(0, parseFloat((permissionMinutes / 60).toFixed(2)));
      } else if (formData.type === 'entrata_posticipata' && formData.entryTime) {
        // Entrata posticipata: calcola le ore di lavoro perse dall'inizio a entryTime
        // IMPORTANTE: considera la pausa pranzo se l'entrata è dopo la pausa
        const entryMinutes = timeToMinutes(formData.entryTime);
        const standardStartMinutes = timeToMinutes(workSchedule.start_time);
        const breakDuration = workSchedule.break_duration !== null && workSchedule.break_duration !== undefined ? workSchedule.break_duration : 0;
        
        // Calcola l'inizio e fine della pausa pranzo
        let breakStartMinutes = null;
        let breakEndMinutes = null;
        
        if (breakDuration > 0 && workSchedule.break_start_time) {
          breakStartMinutes = timeToMinutes(workSchedule.break_start_time);
          breakEndMinutes = breakStartMinutes + breakDuration;
        } else if (breakDuration > 0) {
          const endMinutes = timeToMinutes(workSchedule.end_time);
          const totalMinutes = endMinutes - standardStartMinutes;
          breakStartMinutes = standardStartMinutes + (totalMinutes / 2) - (breakDuration / 2);
          breakEndMinutes = breakStartMinutes + breakDuration;
        }
        
        // Calcola le ore di permesso
        let permissionMinutes = 0;
        
        if (entryMinutes >= breakEndMinutes) {
          // Entra dopo la pausa: perde solo la mattina
          permissionMinutes = entryMinutes - standardStartMinutes - breakDuration;
        } else if (entryMinutes <= breakStartMinutes) {
          // Entra prima della pausa: perde solo la mattina fino all'entrata
          permissionMinutes = entryMinutes - standardStartMinutes;
        } else {
          // Entra durante la pausa: perde la mattina + parte della pausa
          permissionMinutes = entryMinutes - standardStartMinutes;
        }
        
        return Math.max(0, parseFloat((permissionMinutes / 60).toFixed(2)));
      }
    }
    
    // Fallback: se non abbiamo l'orario, usa valori di default (non dovrebbe accadere)
    return 0;
  };

  // Formatta le ore in modo leggibile (1h 42m invece di 1.7h)
  const formatHoursReadable = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.permissionDate) {
      showError('Seleziona una data per il permesso');
      return;
    }

    // Se è permesso tutta la giornata, verifica che le ore siano state calcolate
    if (formData.type === 'full_day') {
      if (!fullDayHours || fullDayHours <= 0) {
        showError('Impossibile calcolare le ore. Verifica di avere un orario configurato per questo giorno.');
        return;
      }
    } else {
      // Valida campi per permessi parziali
      if (formData.type === 'uscita_anticipata' && !formData.exitTime) {
        showError('Inserisci l\'orario di uscita');
        return;
      }
      if (formData.type === 'entrata_posticipata' && !formData.entryTime) {
        showError('Inserisci l\'orario di entrata');
        return;
      }
    }

    // Calcola automaticamente le ore di permesso
    const calculatedHours = formData.type === 'full_day' ? fullDayHours : calculatePermissionHours();
    
    if (!calculatedHours || calculatedHours <= 0) {
      showError('Impossibile calcolare le ore di permesso. Verifica di avere un orario configurato per questo giorno.');
      return;
    }
    
    try {
      const response = await apiCall('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'permission',
          startDate: formData.permissionDate,
          endDate: formData.permissionDate,
          reason: formData.type === 'full_day' ? 'Permesso - Tutta la giornata' : (formData.type === 'uscita_anticipata' ? 'Uscita Anticipata' : 'Entrata Posticipata'),
          notes: formData.notes,
          permissionType: formData.type === 'full_day' ? 'full_day' : (formData.type === 'uscita_anticipata' ? 'early_exit' : 'late_entry'),
          hours: calculatedHours,
          exitTime: formData.type === 'full_day' ? null : formData.exitTime,
          entryTime: formData.type === 'full_day' ? null : formData.entryTime
        })
      });
      
      if (response.ok) {
        // Ricarica le richieste dal backend
        await fetchRequests();
        setFormData({
          type: 'uscita_anticipata',
          permissionDate: '',
          exitTime: '',
          entryTime: '',
          notes: '',
          fullDay: false
        });
        setShowNewRequest(false);
        setFullDayHours(null);
        showSuccess('Richiesta inviata con successo!');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Errore nel salvataggio' }));
        showError(`Errore: ${errorData.error || 'Errore nel salvataggio'}`);
      }
    } catch (error) {
      console.error('Errore:', error);
      showError('Errore nel salvataggio della richiesta. Verifica la connessione e riprova.');
    }
  };

  const handleCancel = () => {
    setFormData({
      type: 'uscita_anticipata',
      permissionDate: '',
      exitTime: '',
      entryTime: '',
      notes: '',
      fullDay: false
    });
    setFullDayHours(null);
    setShowNewRequest(false);
  };

  // Funzioni per filtri temporali
  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Filtra le richieste per il mese/anno selezionato, ricerca e tab attiva
  const parseRequestDate = (request, includeTime = false) => {
    const rawDate = request.permissionDate || request.startDate || request.start_date;
    if (!rawDate) return null;
    const date = new Date(rawDate);
    if (isNaN(date.getTime())) return null;

    if (includeTime) {
      // Prova entrambi i formati: camelCase e snake_case
      const timeStr = request.exitTime || request.exit_time || request.entryTime || request.entry_time;
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
          date.setHours(hours, minutes, 0, 0);
        }
      }
    }

    return date;
  };

  const canCancelRequest = (request) => {
    if (request.status !== 'approved') return false;
    const dateWithTime = parseRequestDate(request, true);
    if (!dateWithTime) return true;
    // Permetti annullamento solo se l'orario del permesso è almeno 2 ore nel futuro
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return dateWithTime > twoHoursFromNow;
  };

  const canModifyRequest = (request) => {
    if (request.status !== 'approved') return false;
    const dateWithTime = parseRequestDate(request, true);
    if (!dateWithTime) return true; // Se non c'è orario, permettere modifica
    // Permetti modifica solo se l'orario del permesso è almeno 2 ore nel futuro
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return dateWithTime > twoHoursFromNow;
  };

  const canRequestModification = (request) => {
    if (request.status !== 'approved') return false;
    const dateWithTime = parseRequestDate(request, true);
    if (!dateWithTime) return true; // Se non c'è orario, permettere richiesta modifica
    // Permetti richiesta modifica solo se l'orario del permesso è almeno 2 ore nel futuro
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return dateWithTime > twoHoursFromNow;
  };

  const getFilteredRequests = () => {
    let filtered = requests;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filtro per tab (solo admin)
    if (user?.role === 'admin') {
      if (activeTab === 'imminenti') {
        filtered = filtered
          .filter(request => {
            if (request.status === 'pending') return true;
            if (request.status !== 'approved') return false;

            const requestDate = parseRequestDate(request);
            if (!requestDate) return false;

            if (requestDate > todayStart) {
              return true;
            }

            if (requestDate < todayStart) {
              return false;
            }

            const requestMoment = parseRequestDate(request, true);
            return requestMoment ? requestMoment > now : false;
          })
          .sort((a, b) => {
            const dateA = parseRequestDate(a, true)?.getTime() || 0;
            const dateB = parseRequestDate(b, true)?.getTime() || 0;
            return dateA - dateB;
          });
      } else {
        // Tab "Cronologia": filtra per mese/anno selezionato (tutti gli status)
        filtered = filtered.filter(request => {
          const requestDate = parseRequestDate(request);
          if (!requestDate) return false;
          // Filtra per mese/anno - include tutti gli status (pending, approved, rejected)
          return requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear;
        });
      }
    } else {
      // Per dipendenti: mostra permessi del mese/anno selezionato E permessi futuri (almeno 2 mesi avanti)
      filtered = filtered.filter(request => {
        const requestDate = parseRequestDate(request);
        if (!requestDate) return false;
        
        // Mostra sempre permessi futuri (oltre il mese corrente)
        const requestMonth = requestDate.getMonth();
        const requestYear = requestDate.getFullYear();
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Se il permesso è futuro (oltre il mese corrente), mostralo sempre
        if (requestYear > currentYear || (requestYear === currentYear && requestMonth > currentMonth)) {
          return true;
        }
        
        // Altrimenti filtra per mese/anno selezionato (tutti gli status)
        return requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear;
      });
    }
    
    // Filtro per ricerca
    if (searchTerm.trim()) {
      filtered = filtered.filter(request => {
        const searchLower = searchTerm.toLowerCase();
        return (
          request.notes?.toLowerCase().includes(searchLower) ||
          request.submittedBy?.toLowerCase().includes(searchLower) ||
          request.status?.toLowerCase().includes(searchLower) ||
          request.permissionType?.toLowerCase().includes(searchLower)
        );
      });
    }
    
    return filtered;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved':
        return 'Approvata';
      case 'rejected':
        return 'Rifiutata';
      case 'cancelled':
        return 'Annullata';
      case 'pending':
        return 'In attesa';
      default:
        return 'Sconosciuto';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'cancelled':
        return 'bg-orange-500/20 text-orange-300 border-orange-400/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'permission':
        return 'Permesso';
      case 'leave':
        return 'Congedo';
      case 'emergency':
        return 'Emergenza';
      default:
        return 'Permesso';
    }
  };

  // Ottieni il tipo di richiesta dettagliato per i permessi
  const getPermissionTypeText = (request) => {
    if (request.type === 'permission' || request.type === 'permission_104') {
      if (request.permissionType === 'uscita_anticipata' || request.permissionType === 'early_exit') {
        return 'Uscita Anticipata';
      } else if (request.permissionType === 'entrata_posticipata' || request.permissionType === 'late_entry') {
        return 'Entrata Posticipata';
      } else if (request.permissionType === 'permesso_104') {
        return 'Permesso 104';
      }
    }
    return getTypeText(request.type);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Data non disponibile';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Data non valida';
      return date.toLocaleDateString('it-IT');
    } catch (error) {
      return 'Data non valida';
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  // Formatta orario senza secondi (HH:mm invece di HH:mm:ss)
  const formatTimeWithoutSeconds = (timeString) => {
    if (!timeString) return '';
    // Se contiene già solo HH:mm, restituiscilo così
    if (timeString.match(/^\d{2}:\d{2}$/)) {
      return timeString;
    }
    // Se contiene HH:mm:ss, rimuovi i secondi
    if (timeString.match(/^\d{2}:\d{2}:\d{2}$/)) {
      return timeString.substring(0, 5);
    }
    // Prova a parsare come Date e formattare
    try {
      const [hours, minutes] = timeString.split(':');
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } catch {
      return timeString;
    }
  };

  // Formatta ore con orario (es. "45 min | 10:45")
  const formatHoursWithTime = (hours, time) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    const timeStr = time ? ` | ${formatTimeWithoutSeconds(time)}` : '';
    
    if (h > 0) {
      return `${h}h ${m}m${timeStr}`;
    } else {
      return `${m} min${timeStr}`;
    }
  };

  const calculateDays = (startDate, endDate) => {
    if (startDate === endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };


  if (loading) {
    return <PermessiSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-0">
      {/* Header Mobile-First: Design completamente diverso su mobile */}
      {/* Mobile: Header compatto con titolo e icona */}
      <div className="lg:hidden bg-slate-800 rounded-lg p-4 sticky top-16 z-20 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="h-5 w-5 text-indigo-400 flex-shrink-0" />
            <h1 className="text-lg font-bold text-white truncate">
              {user?.role === 'admin' ? 'Permessi' : 'I Miei Permessi'}
            </h1>
          </div>
          <button
            onClick={() => user?.role === 'admin' ? setShowAdminCreateModal(true) : setShowNewRequest(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center shadow-lg"
            aria-label="Aggiungi permesso"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        
        {/* Tab per admin - Full width su mobile */}
        {user?.role === 'admin' && (
          <div className="flex bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('imminenti')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
                activeTab === 'imminenti'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400'
              }`}
            >
              Imminenti
            </button>
            <button
              onClick={() => setActiveTab('cronologia')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors touch-manipulation min-h-[44px] ${
                activeTab === 'cronologia'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400'
              }`}
            >
              Cronologia
            </button>
          </div>
        )}
      </div>

      {/* Desktop: Header tradizionale */}
      <div className="hidden lg:block bg-slate-800 rounded-lg p-6">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white flex items-center">
              <FileText className="h-8 w-8 mr-3 text-indigo-400 flex-shrink-0" />
              <span className="truncate">{user?.role === 'admin' ? 'Gestione Permessi' : 'I Miei Permessi'}</span>
            </h1>
            <p className="text-slate-400 mt-2 text-base">
              {user?.role === 'admin' 
                ? 'Visualizza e gestisci tutte le richieste di permessi dei dipendenti'
                : 'Gestisci le tue richieste di permessi e visualizza lo storico'
              }
            </p>
          </div>
          
          {/* Tab e Pulsante per Admin - Desktop */}
          {user?.role === 'admin' && (
            <div className="flex flex-row items-center gap-4 flex-shrink-0">
              <div className="flex bg-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('imminenti')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'imminenti'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Imminenti
                </button>
                <button
                  onClick={() => setActiveTab('cronologia')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'cronologia'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cronologia
                </button>
              </div>
              <button
                onClick={() => setShowAdminCreateModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center text-base"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Aggiungi
              </button>
            </div>
          )}
          {user?.role !== 'admin' && (
            <button
              onClick={() => setShowNewRequest(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Aggiungi
            </button>
          )}
        </div>
      </div>

      {/* Filtri Collassabili */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setFiltersCollapsed(!filtersCollapsed)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Filter className="h-5 w-5 text-indigo-400" />
            <span className="text-white font-medium">Filtri e Ricerca</span>
          </div>
          {filtersCollapsed ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          )}
        </button>
        
        {!filtersCollapsed && (
          <div className="border-t border-slate-700 p-4 space-y-4">
            {/* Filtro temporale per admin - Responsive: stack verticale su mobile */}
            {user?.role === 'admin' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <span className="text-white font-medium text-sm sm:text-base">Filtro per periodo:</span>
                  </div>
                  <button
                    onClick={goToToday}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors touch-manipulation min-h-[44px] w-full sm:w-auto"
                  >
                    OGGI
                  </button>
                </div>
                <div className="flex items-center justify-between sm:justify-center gap-2">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-white font-semibold text-sm sm:text-base text-center flex-1 sm:flex-none sm:min-w-[120px]">
                    {monthNames[currentMonth]} {currentYear}
                  </div>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Campo di ricerca */}
            <div className="flex items-center space-x-4">
              <Search className="h-5 w-5 text-green-400" />
              <input
                type="text"
                placeholder="Cerca per motivo, dipendente, note o stato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {showNewRequest && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowNewRequest(false)}
        >
          <div className="bg-slate-800 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <FileText className="h-6 w-6 mr-2 text-indigo-400" />
                Nuova Richiesta Permesso
              </h2>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tipo di Permesso *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="uscita_anticipata">Uscita Anticipata</option>
                  <option value="entrata_posticipata">Entrata Posticipata</option>
                  <option value="full_day">Giornata completa</option>
                  {user?.has104 && (
                    <option value="permission_104">Permesso 104</option>
                  )}
                </select>
                
                {formData.type === 'full_day' && fullDayHours === null && formData.permissionDate && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠️ Impossibile calcolare le ore. Verifica di avere un orario configurato per questo giorno.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Permesso *
                </label>
                <input
                  type="date"
                  name="permissionDate"
                  value={formData.permissionDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {formData.type === 'uscita_anticipata' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Orario di Uscita *
                  </label>
                  <input
                    type="time"
                    name="exitTime"
                    value={formData.exitTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    {workSchedule 
                      ? `Orario normale di uscita: ${workSchedule.end_time}. Le ore di permesso verranno calcolate automaticamente.`
                      : 'Caricamento orario di lavoro...'}
                  </p>
                </div>
              )}

              {formData.type === 'entrata_posticipata' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Orario di Entrata *
                  </label>
                  <input
                    type="time"
                    name="entryTime"
                    value={formData.entryTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    {workSchedule 
                      ? `Orario normale di entrata: ${workSchedule.start_time}. Le ore di permesso verranno calcolate automaticamente.`
                      : 'Caricamento orario di lavoro...'}
                  </p>
                </div>
              )}

              {/* Mostra ore calcolate automaticamente */}
              {(formData.type === 'full_day' && fullDayHours !== null) || (formData.type !== 'full_day' && calculatePermissionHours() > 0) ? (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-indigo-400 mr-2" />
                    <span className="text-indigo-300 font-medium">
                      Ore di permesso calcolate: {formatHoursReadable(formData.type === 'full_day' ? fullDayHours : calculatePermissionHours())}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Avviso permessi 104 */}
              {formData.type === 'permission_104' && user?.has104 && (
                <div className={`p-4 rounded-lg border ${
                  permissions104.remaining > 0 
                    ? 'bg-amber-500/10 border-amber-500/20' 
                    : 'bg-red-500/10 border-red-500/20'
                }`}>
                  <div className="flex items-center">
                    <CheckCircle className={`h-5 w-5 mr-2 ${
                      permissions104.remaining > 0 ? 'text-amber-400' : 'text-red-400'
                    }`} />
                    <div>
                      <p className={`text-sm font-medium ${
                        permissions104.remaining > 0 ? 'text-amber-200' : 'text-red-200'
                      }`}>
                        {permissions104.remaining > 0 
                          ? `Permessi 104: ${permissions104.usedThisMonth}/${permissions104.maxPerMonth} usati questo mese`
                          : 'Hai raggiunto il limite massimo di 3 permessi 104 al mese'
                        }
                      </p>
                      {permissions104.remaining > 0 && (
                        <p className="text-amber-300 text-xs mt-1">
                          Ti rimangono {permissions104.remaining} permessi 104 per questo mese
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Note Aggiuntive
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Note aggiuntive sul permesso..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 sm:px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors text-sm sm:text-base touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  <X className="h-4 w-4 mr-2" />
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm sm:text-base touch-manipulation min-h-[44px] flex items-center justify-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Invia Richiesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h2 className="text-xl font-bold text-white flex items-center mb-4">
          <Clock className="h-6 w-6 mr-3 text-slate-400" />
          {user?.role === 'admin' ? 'Gestione Richieste Permessi' : 'Storico Richieste Permessi'}
        </h2>

        {(() => {
          const filteredRequests = getFilteredRequests();
          return filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">
                {user?.role === 'admin' 
                  ? (activeTab === 'imminenti' 
                      ? 'Nessuna richiesta imminente'
                      : `Nessuna richiesta per ${monthNames[currentMonth]} ${currentYear}`)
                  : 'Nessuna richiesta di permesso presente'
                }
              </p>
              <p className="text-slate-500 text-sm mt-2">
                {user?.role === 'admin' 
                  ? (activeTab === 'imminenti'
                      ? 'Le richieste approvate con date future appariranno qui'
                      : 'Prova a cambiare mese o aggiungere nuove richieste')
                  : 'Clicca su "Nuova Richiesta" per iniziare'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => {
                const permissionDate = request.permissionDate ? formatDate(request.permissionDate) : 
                                      request.startDate ? formatDate(request.startDate) : 'Data non disponibile';
                const hours = request.hours ? formatHoursReadable(request.hours) : 
                             `${calculateDays(request.startDate, request.endDate)} giorni`;
                const isApproved = request.status === 'approved';
                const isPending = request.status === 'pending';
                const isRejected = request.status === 'rejected';
                
                return (
              <div key={request.id} className={`rounded-lg p-3 bg-slate-700/80 border border-slate-600/50 border-l-4 shadow-lg transition-all hover:shadow-xl hover:bg-slate-700/90 w-full ${
                isApproved ? 'border-l-green-500' : 
                isPending ? 'border-l-yellow-500' : 
                'border-l-red-500'
              }`}>
                {/* HEADER: Status e Tipo */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(request.status)}
                    <div>
                      <h3 className="text-sm font-bold text-white">{getPermissionTypeText(request)}</h3>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isApproved ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                        isPending ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                        'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {getStatusText(request.status)}
                      </span>
                    </div>
                  </div>
                  
                  {/* LATO ADMIN: Dipendente in evidenza */}
                  {user?.role === 'admin' && (
                    <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-lg px-2.5 py-1">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-indigo-400" />
                        <div>
                          <p className="text-xs text-indigo-300">Dipendente</p>
                          <p className="text-xs font-bold text-indigo-200">{request.submittedBy}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* DATI PRINCIPALI: Quando e Per Quanto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  {/* QUANDO */}
                  <div className="bg-slate-600/50 rounded-lg p-2 border border-slate-500/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Data Permesso</span>
                    </div>
                    <p className="text-base font-bold text-white">{permissionDate}</p>
                    {(request.permissionType === 'uscita_anticipata' || request.permissionType === 'early_exit' || request.exitTime) && request.exitTime && (
                      <p className="text-xs text-orange-400 mt-0.5 font-medium">
                        Uscita alle {formatTimeWithoutSeconds(request.exitTime || request.exit_time)}
                      </p>
                    )}
                    {(request.permissionType === 'entrata_posticipata' || request.permissionType === 'late_entry' || request.entryTime) && request.entryTime && (
                      <p className="text-xs text-blue-400 mt-0.5 font-medium">
                        Entrata alle {formatTimeWithoutSeconds(request.entryTime || request.entry_time)}
                      </p>
                    )}
                  </div>

                  {/* PER QUANTO */}
                  <div className="bg-slate-600/50 rounded-lg p-2 border border-slate-500/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Durata</span>
                    </div>
                    <p className="text-base font-bold text-white">{hours}</p>
                    {(request.permissionType === 'uscita_anticipata' || request.permissionType === 'early_exit' || request.exitTime) && (
                      <p className="text-xs text-slate-400 mt-0.5">Uscita Anticipata</p>
                    )}
                    {(request.permissionType === 'entrata_posticipata' || request.permissionType === 'late_entry' || request.entryTime) && (
                      <p className="text-xs text-slate-400 mt-0.5">Entrata Posticipata</p>
                    )}
                  </div>
                </div>

                {/* DATI SECONDARI: Approvazione e Richiesta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  {/* LATO DIPENDENTE: Approvazione */}
                  {user?.role === 'employee' && (
                    <>
                      {isApproved && request.approvedAt && (
                        <div className="bg-green-500/20 rounded-lg p-2 border border-green-500/30">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-xs font-medium text-green-300 uppercase">Approvato</span>
                          </div>
                          <p className="text-xs text-white font-medium">
                            Da: <span className="text-green-300">{request.approver?.name || request.approvedBy || 'Amministratore'}</span>
                          </p>
                          <p className="text-xs text-slate-300 mt-0.5">
                            {formatDateTime(request.approvedAt)}
                          </p>
                        </div>
                      )}
                      {isPending && (
                        <div className="bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
                          <div className="flex items-center gap-1.5">
                            <Timer className="h-3 w-3 text-yellow-400" />
                            <span className="text-xs text-yellow-300 font-medium">In attesa di approvazione</span>
                          </div>
                        </div>
                      )}
                      {isRejected && request.rejectedAt && (
                        <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <XCircle className="h-3 w-3 text-red-400" />
                            <span className="text-xs font-medium text-red-300 uppercase">Rifiutato</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDateTime(request.rejectedAt)}
                          </p>
                        </div>
                      )}
                      <div className="bg-slate-600/50 rounded-lg p-2 border border-slate-500/50">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span className="text-xs font-medium text-slate-400 uppercase">Richiesta il</span>
                        </div>
                        <p className="text-xs text-white">{formatDateTime(request.submittedAt)}</p>
                      </div>
                    </>
                  )}

                  {/* LATO ADMIN: Info Approvazione */}
                  {user?.role === 'admin' && (
                    <>
                      {isApproved && request.approvedAt && (
                        <div className="bg-green-500/20 rounded-lg p-2 border border-green-500/30">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-xs font-medium text-green-300 uppercase">Approvato</span>
                          </div>
                          <p className="text-xs text-white">
                            {formatDateTime(request.approvedAt)}
                          </p>
                        </div>
                      )}
                      {isPending && (
                        <div className="bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
                          <div className="flex items-center gap-1.5">
                            <Timer className="h-3 w-3 text-yellow-400" />
                            <span className="text-xs text-yellow-300 font-medium">In attesa</span>
                          </div>
                        </div>
                      )}
                      <div className="bg-slate-600/50 rounded-lg p-2 border border-slate-500/50">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span className="text-xs font-medium text-slate-400 uppercase">Richiesta il</span>
                        </div>
                        <p className="text-xs text-white">{formatDateTime(request.submittedAt)}</p>
                      </div>
                    </>
                  )}
                </div>
                {/* NOTE E MOTIVI */}
                {(request.notes || request.rejectionReason) && (
                  <div className="space-y-1.5 mb-2">
                    {request.notes && (
                      <div className="bg-slate-600/50 rounded-lg p-2 border border-slate-500/50">
                        <div className="flex items-start gap-1.5">
                          <FileText className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-slate-400 mb-0.5">Note</p>
                            <p className="text-xs text-slate-300">{request.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {request.rejectionReason && (
                      <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                        <div className="flex items-start gap-1.5">
                          <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-red-300 mb-0.5">Motivo Rifiuto</p>
                            <p className="text-xs text-red-200">{request.rejectionReason}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* PULSANTI AZIONE */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-600/50">
                  {/* Pulsanti di approvazione per admin - solo per richieste pending */}
                  {user?.role === 'admin' && request.status === 'pending' && (
                    <>
                      <button
                        onClick={() => openApproveDialog(request.id)}
                        className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-xs min-h-[36px]"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Approva
                      </button>
                      <button
                        onClick={() => openRejectDialog(request.id)}
                        className="flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-xs min-h-[36px]"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Rifiuta
                      </button>
                    </>
                  )}

                  {/* Pulsanti di modifica e annullamento per admin - solo per richieste approvate */}
                  {user?.role === 'admin' && request.status === 'approved' && request.type === 'permission' && (
                    <>
                      {canModifyRequest(request) && (
                        <button
                          onClick={() => openEditDialog(request)}
                          className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors touch-manipulation min-h-[36px] font-medium text-xs"
                        >
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Modifica
                        </button>
                      )}
                      {canCancelRequest(request) && (
                        <button
                          onClick={() => openCancelDialog(request.id)}
                          className="flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors touch-manipulation min-h-[36px] font-medium text-xs"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Annulla
                        </button>
                      )}
                    </>
                  )}

                  {/* Pulsante richiesta modifica per dipendenti - solo per richieste approvate e se l'orario non è ancora passato */}
                  {user?.role === 'employee' && request.status === 'approved' && request.type === 'permission' && canRequestModification(request) && (
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setModificationRequest({ reason: '', requestedChanges: '' });
                        setShowRequestModificationDialog(true);
                      }}
                      className="flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors touch-manipulation min-h-[36px] font-medium text-xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      Richiedi Modifica
                    </button>
                  )}
                </div>
              </div>
              );
              })}
          </div>
          );
        })()}
      </div>

      {/* Dialog di approvazione */}
      {showApproveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApproveDialog(false)} />
          <div className="relative bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Approva Richiesta</h3>
            <p className="text-slate-300 mb-4">Inserisci le note per l'approvazione (opzionale):</p>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={3}
              placeholder="Note per l'approvazione..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowApproveDialog(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmApprove}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Approva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog di rifiuto */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRejectDialog(false)} />
          <div className="relative bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Rifiuta Richiesta</h3>
            <p className="text-slate-300 mb-4">Inserisci il motivo del rifiuto (opzionale):</p>
            <textarea
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={3}
              placeholder="Motivo del rifiuto..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowRejectDialog(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Rifiuta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog di annullamento */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCancelDialog(false)} />
          <div className="relative bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Annulla Richiesta</h3>
            <p className="text-slate-300 mb-4">Inserisci il motivo dell'annullamento (opzionale):</p>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={3}
              placeholder="Motivo dell'annullamento..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Conferma Annullamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog di modifica permesso */}
      {showEditDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditDialog(false)} />
          <div className="relative bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Modifica Permesso</h3>
            <p className="text-slate-300 mb-4 text-sm">
              Modifica gli orari o le ore di permesso per correggere eventuali discrepanze.
            </p>
            
            <div className="space-y-4">
              {(selectedRequest.permissionType === 'entrata_posticipata' || selectedRequest.permissionType === 'late_entry' || selectedRequest.entryTime) && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Orario di Entrata *
                  </label>
                  <input
                    type="time"
                    value={editFormData.entryTime}
                    onChange={(e) => {
                      const newEntryTime = e.target.value;
                      setEditFormData({ ...editFormData, entryTime: newEntryTime });
                      // Calcola le ore usando editWorkSchedule o selectedRequest come fallback
                      const schedule = editWorkSchedule || (selectedRequest.workSchedule ? {
                        start_time: Object.values(selectedRequest.workSchedule).find(s => s.active)?.startTime || Object.values(selectedRequest.workSchedule).find(s => s.active)?.start_time,
                        end_time: Object.values(selectedRequest.workSchedule).find(s => s.active)?.endTime || Object.values(selectedRequest.workSchedule).find(s => s.active)?.end_time
                      } : null);
                      if (schedule) {
                        calculateEditHours(newEntryTime, editFormData.exitTime, { ...selectedRequest, workSchedule: schedule });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    Orario attuale: {formatTimeWithoutSeconds(selectedRequest.entryTime || selectedRequest.entry_time) || 'Non impostato'}
                    {editWorkSchedule && (
                      <span className="block mt-1">
                        Orario normale di entrata: {editWorkSchedule.start_time}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {(selectedRequest.permissionType === 'uscita_anticipata' || selectedRequest.permissionType === 'early_exit' || selectedRequest.exitTime) && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Orario di Uscita *
                  </label>
                  <input
                    type="time"
                    value={editFormData.exitTime}
                    onChange={(e) => {
                      const newExitTime = e.target.value;
                      setEditFormData({ ...editFormData, exitTime: newExitTime });
                      // Calcola le ore usando editWorkSchedule o selectedRequest come fallback
                      const schedule = editWorkSchedule || (selectedRequest.workSchedule ? {
                        start_time: Object.values(selectedRequest.workSchedule).find(s => s.active)?.startTime || Object.values(selectedRequest.workSchedule).find(s => s.active)?.start_time,
                        end_time: Object.values(selectedRequest.workSchedule).find(s => s.active)?.endTime || Object.values(selectedRequest.workSchedule).find(s => s.active)?.end_time
                      } : null);
                      if (schedule) {
                        calculateEditHours(editFormData.entryTime, newExitTime, { ...selectedRequest, workSchedule: schedule });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    Orario attuale: {formatTimeWithoutSeconds(selectedRequest.exitTime || selectedRequest.exit_time) || 'Non impostato'}
                    {editWorkSchedule && (
                      <span className="block mt-1">
                        Orario normale di uscita: {editWorkSchedule.end_time}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Mostra le ore calcolate automaticamente */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Clock className="h-5 w-5 text-blue-400 mr-2" />
                  <span className="text-blue-300 font-medium">Ore di Permesso (calcolate automaticamente)</span>
                </div>
                {calculatedHours !== null ? (
                  <div>
                    <p className="text-blue-200 text-lg font-semibold">
                      {formatHoursReadable(calculatedHours)}
                    </p>
                    <p className="text-blue-300 text-xs mt-1">
                      Le ore verranno calcolate automaticamente in base all'orario di lavoro del dipendente
                    </p>
                  </div>
                ) : selectedRequest.hours ? (
                  <div>
                    <p className="text-blue-200 text-lg font-semibold">
                      Attuali: {selectedRequest.hours}h ({formatHoursReadable(selectedRequest.hours)})
                    </p>
                    <p className="text-blue-300 text-xs mt-1">
                      Modifica l'orario sopra per ricalcolare automaticamente le ore
                    </p>
                  </div>
                ) : (
                  <p className="text-blue-300 text-sm">
                    Modifica l'orario per vedere le ore calcolate automaticamente
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowEditDialog(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors touch-manipulation min-h-[44px]"
              >
                Annulla
              </button>
              <button
                onClick={handleEditPermission}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors touch-manipulation min-h-[44px] flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert custom */}
      <CustomAlert
        isOpen={alert.isOpen}
        onClose={hideAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onConfirm={alert.onConfirm}
        showCancel={alert.showCancel}
        confirmText={alert.confirmText}
        cancelText={alert.cancelText}
      />

      {/* Modal Admin Crea Permesso per Dipendente */}
      <AdminCreatePermissionModal
        isOpen={showAdminCreateModal}
        onClose={() => setShowAdminCreateModal(false)}
        onSuccess={() => {
          fetchRequests();
          showSuccess('Permesso registrato!', 'Il permesso è stato registrato e il dipendente è stato notificato.');
        }}
      />

      {/* Modal Richiesta Modifica (Dipendente) */}
      {showRequestModificationDialog && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-amber-400" />
              Richiedi Modifica Permesso
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Stai richiedendo una modifica al permesso approvato per il <strong>
                {selectedRequest.permissionDate ? formatDate(selectedRequest.permissionDate) : 
                 selectedRequest.startDate ? formatDate(selectedRequest.startDate) : 'Data non disponibile'}
              </strong>.
              L'amministratore riceverà una notifica e potrà modificare il permesso.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Motivo della richiesta *
                </label>
                <textarea
                  value={modificationRequest.reason}
                  onChange={(e) => setModificationRequest({ ...modificationRequest, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Spiega perché vuoi modificare questo permesso..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Modifiche richieste (opzionale)
                </label>
                <textarea
                  value={modificationRequest.requestedChanges}
                  onChange={(e) => setModificationRequest({ ...modificationRequest, requestedChanges: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Descrivi le modifiche che vorresti (es. cambiare orario di uscita, modificare le ore...)"
                />
              </div>

              {selectedRequest && (
                <div className="bg-slate-700/50 rounded-lg p-3 text-sm">
                  <p className="text-slate-400 mb-1">Permesso attuale:</p>
                  <p className="text-white">
                    {selectedRequest.permissionType === 'uscita_anticipata' || selectedRequest.permissionType === 'early_exit' || selectedRequest.exitTime ? (
                      <>Uscita Anticipata {selectedRequest.exitTime && `alle ${formatTimeWithoutSeconds(selectedRequest.exitTime)}`}</>
                    ) : selectedRequest.permissionType === 'entrata_posticipata' || selectedRequest.permissionType === 'late_entry' || selectedRequest.entryTime ? (
                      <>Entrata Posticipata {selectedRequest.entryTime && `alle ${formatTimeWithoutSeconds(selectedRequest.entryTime)}`}</>
                    ) : (
                      <>Permesso per {selectedRequest.hours ? formatHoursReadable(selectedRequest.hours) : 'giornata intera'}</>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowRequestModificationDialog(false);
                  setSelectedRequest(null);
                  setModificationRequest({ reason: '', requestedChanges: '' });
                }}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
              >
                Annulla
              </button>
              <button
                onClick={handleRequestModification}
                disabled={!modificationRequest.reason || !modificationRequest.reason.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors min-h-[44px] flex items-center"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Invia Richiesta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequests;