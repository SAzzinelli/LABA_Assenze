import React from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
import { useAuthStore } from '../utils/store';
import MonteOreCalculator from '../components/MonteOreCalculator';

const defaultWorkSchedule = {
  monday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
  tuesday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
  wednesday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
  thursday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
  friday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
  saturday: { active: false, morning: '', afternoon: '', lunchBreak: '', workType: 'none' },
  sunday: { active: false, morning: '', afternoon: '', lunchBreak: '', workType: 'none' }
};

const BancaOre = () => {
  const { user, apiCall } = useAuthStore();
  const [workSchedule, setWorkSchedule] = React.useState(defaultWorkSchedule);
  const [loadingSchedule, setLoadingSchedule] = React.useState(true);

  React.useEffect(() => {
    const loadWorkSchedule = async () => {
      if (!user) {
        setLoadingSchedule(false);
        return;
      }

      try {
        setLoadingSchedule(true);
        const response = await apiCall('/api/work-schedules');

        if (response?.ok || Array.isArray(response)) {
          const schedules = Array.isArray(response) ? response : await response.json();
          const formattedSchedule = { ...defaultWorkSchedule };
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

          schedules.forEach(schedule => {
            const dayName = dayNames[schedule.day_of_week];
            if (!dayName || !formattedSchedule[dayName]) return;

            formattedSchedule[dayName] = {
              active: schedule.is_working_day,
              morning: schedule.work_type === 'morning' ? `${schedule.start_time}-${schedule.end_time}` :
                       schedule.work_type === 'full_day' ? `${schedule.start_time}-${schedule.end_time}` : '',
              afternoon: schedule.work_type === 'afternoon' ? `${schedule.start_time}-${schedule.end_time}` :
                         schedule.work_type === 'full_day' ? `${schedule.start_time}-${schedule.end_time}` : '',
              lunchBreak: schedule.work_type === 'full_day' ? '13:00-14:00' : '',
              workType: schedule.work_type === 'full_day' ? 'full' : schedule.work_type
            };
          });

          setWorkSchedule(formattedSchedule);
          // Salva per utilizzo futuro offline
          localStorage.setItem('workSchedule', JSON.stringify(formattedSchedule));
        } else {
          const savedSchedule = localStorage.getItem('workSchedule');
          if (savedSchedule) {
            setWorkSchedule(JSON.parse(savedSchedule));
          }
        }
      } catch (error) {
        console.error('Error loading work schedule:', error);
        const savedSchedule = localStorage.getItem('workSchedule');
        if (savedSchedule) {
          setWorkSchedule(JSON.parse(savedSchedule));
        }
      } finally {
        setLoadingSchedule(false);
      }
    };

    loadWorkSchedule();
  }, [user, apiCall]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <DollarSign className="h-8 w-8 mr-3 text-indigo-400" />
              Banca Ore
            </h1>
            <p className="text-slate-400 mt-2">
              Monitora il tuo saldo ore complessivo e le fluttuazioni recenti.
            </p>
          </div>
        </div>
      </div>

      {loadingSchedule ? (
        <div className="bg-slate-800 rounded-lg p-10 text-center border border-slate-700">
          <Loader2 className="h-10 w-10 text-indigo-300 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Caricamento orario di lavoro...</p>
          <p className="text-slate-500 text-sm mt-2">
            Stiamo recuperando i tuoi dati aggiornati di orario e banca ore.
          </p>
        </div>
      ) : (
        <MonteOreCalculator user={user} workSchedule={workSchedule} />
      )}
    </div>
  );
};

export default BancaOre;

