import React, { useState } from 'react';
import { User, Building2, Calendar, MapPin, FileText, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';

const RegistrationSteps = ({ onRegister, loading }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Informazioni Personali
    firstName: '',
    lastName: '',
    birthDate: '',
    email: '',
    confirmEmail: '',
    password: '',
    confirmPassword: '',
    phone: '',
    has104: false,
    
    // Step 2: Informazioni Lavorative
    department: '',
    workplace: '',
    contractType: '',
    
    // Step 3: Orario di Lavoro
    workSchedules: {
      monday: { isWorking: true, startTime: '09:00', endTime: '18:00', breakDuration: 60 },
      tuesday: { isWorking: true, startTime: '09:00', endTime: '18:00', breakDuration: 60 },
      wednesday: { isWorking: true, startTime: '09:00', endTime: '18:00', breakDuration: 60 },
      thursday: { isWorking: true, startTime: '09:00', endTime: '18:00', breakDuration: 60 },
      friday: { isWorking: true, startTime: '09:00', endTime: '18:00', breakDuration: 60 },
      saturday: { isWorking: false, startTime: '09:00', endTime: '18:00', breakDuration: 60 },
      sunday: { isWorking: false, startTime: '09:00', endTime: '18:00', breakDuration: 60 }
    }
  });

  const steps = [
    { id: 1, title: 'Informazioni Personali', icon: User },
    { id: 2, title: 'Informazioni Lavorative', icon: Building2 },
    { id: 3, title: 'Orario di Lavoro', icon: Calendar },
    { id: 4, title: 'Verifica Dati', icon: CheckCircle }
  ];

  const departments = ['Amministrazione', 'Segreteria', 'Orientamento', 'Reparto IT']; // System Owner nascosto
  const workplaces = [
    { value: 'badia', label: 'Piazza di Badia a Ripoli 1/A' },
    { value: 'vecchietti', label: 'Via de\' Vecchietti 6' }
  ];
  const contractTypes = [
    'Full Time - Indeterminato',
    'Part Time - Indeterminato', 
    'Full Time - Determinato',
    'Part Time - Determinato',
    'P.IVA',
    'Co.Co.Co.',
    'Apprendistato'
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleWorkScheduleChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      workSchedules: {
        ...prev.workSchedules,
        [day]: {
          ...prev.workSchedules[day],
          [field]: value
        }
      }
    }));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return formData.firstName && 
               formData.lastName && 
               formData.birthDate && 
               formData.email && 
               formData.confirmEmail &&
               formData.password && 
               formData.confirmPassword &&
               formData.phone &&
               formData.email === formData.confirmEmail &&
               formData.password === formData.confirmPassword;
      case 2:
        return formData.department && 
               formData.workplace && 
               formData.contractType;
      case 3:
        // Verifica che almeno un giorno sia selezionato come giorno lavorativo
        return Object.values(formData.workSchedules).some(day => day.isWorking);
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length && validateCurrentStep()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('Le password non corrispondono');
      return;
    }
    if (formData.email !== formData.confirmEmail) {
      alert('Le email non corrispondono');
      return;
    }
    onRegister(formData);
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Informazioni Personali</h3>
        <p className="text-slate-400">Inserisci i tuoi dati personali</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Nome *</label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
            required
          />
        </div>

        {/* Cognome */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Cognome *</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
            required
          />
        </div>

        {/* Data di Nascita */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Data di Nascita *</label>
          <input
            type="date"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
            placeholder="nome.cognome@labafirenze.com"
            required
          />
        </div>

        {/* Conferma Email */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Conferma Email *</label>
          <input
            type="email"
            name="confirmEmail"
            value={formData.confirmEmail}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
            placeholder="conferma la tua email"
            required
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Password *</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
            required
          />
        </div>

        {/* Conferma Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Conferma Password *</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
            required
          />
        </div>

        {/* Telefono */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Telefono *</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
            placeholder="+39 333 123 4567"
            required
          />
        </div>

      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          name="has104"
          checked={formData.has104}
          onChange={handleInputChange}
          className="h-4 w-4 text-zinc-600 bg-zinc-800 border-zinc-700 rounded focus:ring-zinc-600"
        />
        <label className="ml-2 text-sm text-slate-300">
          Beneficiario Legge 104
        </label>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Informazioni Lavorative</h3>
        <p className="text-slate-400">Inserisci i tuoi dati lavorativi</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Dipartimento *</label>
          <div className="relative">
            <select
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 appearance-none cursor-pointer"
              required
            >
              <option value="">Seleziona dipartimento</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Sede di Lavoro *</label>
          <div className="relative">
            <select
              name="workplace"
              value={formData.workplace}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 appearance-none cursor-pointer"
              required
            >
              <option value="">Seleziona sede</option>
              {workplaces.map(workplace => (
                <option key={workplace.value} value={workplace.value}>{workplace.label}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-2">Tipo Contratto *</label>
          <div className="relative">
            <select
              name="contractType"
              value={formData.contractType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 appearance-none cursor-pointer"
              required
            >
              <option value="">Seleziona tipo contratto</option>
              {contractTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Orario di Lavoro</h3>
        <p className="text-slate-400">Configura il tuo orario di lavoro settimanale</p>
      </div>

      <div className="space-y-4">
        {Object.entries(formData.workSchedules).map(([day, schedule]) => {
          const dayNames = {
            monday: 'Lunedì',
            tuesday: 'Martedì', 
            wednesday: 'Mercoledì',
            thursday: 'Giovedì',
            friday: 'Venerdì',
            saturday: 'Sabato',
            sunday: 'Domenica'
          };

          return (
            <div key={day} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-white">{dayNames[day]}</h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.isWorking}
                    onChange={(e) => handleWorkScheduleChange(day, 'isWorking', e.target.checked)}
                    className="w-4 h-4 text-zinc-600 bg-zinc-800 border-zinc-700 rounded focus:ring-zinc-600 focus:ring-2"
                  />
                  <span className="text-slate-300">Giorno lavorativo</span>
                </label>
              </div>

              {schedule.isWorking && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Ora Inizio</label>
                    <input
                      type="time"
                      value={schedule.startTime}
                      onChange={(e) => handleWorkScheduleChange(day, 'startTime', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Ora Fine</label>
                    <input
                      type="time"
                      value={schedule.endTime}
                      onChange={(e) => handleWorkScheduleChange(day, 'endTime', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Pausa (minuti)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      step="15"
                      value={schedule.breakDuration}
                      onChange={(e) => handleWorkScheduleChange(day, 'breakDuration', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    />
                    <p className="text-xs text-slate-400 mt-1">La pausa sarà automaticamente a metà giornata</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
        <p className="text-slate-300 text-sm">
          <strong>Nota:</strong> L'orario configurato verrà utilizzato per il calcolo automatico delle presenze. 
          Potrai modificarlo successivamente nelle impostazioni del tuo profilo.
        </p>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Verifica Dati</h3>
        <p className="text-slate-400">Controlla i dati inseriti prima di procedere</p>
      </div>

      <div className="bg-zinc-800 rounded-lg p-6 space-y-4 border border-zinc-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-slate-400" />
              Informazioni Personali
            </h4>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-400">Nome:</span> <span className="text-white">{formData.firstName} {formData.lastName}</span></p>
              <p><span className="text-slate-400">Email:</span> <span className="text-white">{formData.email}</span></p>
              <p><span className="text-slate-400">Telefono:</span> <span className="text-white">{formData.phone}</span></p>
              <p><span className="text-slate-400">Data Nascita:</span> <span className="text-white">{formData.birthDate}</span></p>
              <p><span className="text-slate-400">Legge 104:</span> <span className="text-white">{formData.has104 ? 'Sì' : 'No'}</span></p>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-slate-400" />
              Informazioni Lavorative
            </h4>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-400">Dipartimento:</span> <span className="text-white">{formData.department}</span></p>
              <p><span className="text-slate-400">Sede:</span> <span className="text-white">{workplaces.find(w => w.value === formData.workplace)?.label}</span></p>
              <p><span className="text-slate-400">Contratto:</span> <span className="text-white">{formData.contractType}</span></p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-slate-400" />
            Orario di Lavoro
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(formData.workSchedules).map(([day, schedule]) => {
              const dayNames = {
                monday: 'Lunedì',
                tuesday: 'Martedì', 
                wednesday: 'Mercoledì',
                thursday: 'Giovedì',
                friday: 'Venerdì',
                saturday: 'Sabato',
                sunday: 'Domenica'
              };

              if (!schedule.isWorking) return null;

              return (
                <div key={day} className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-700">
                  <p className="text-white font-medium">{dayNames[day]}</p>
                  <p className="text-slate-300 text-sm">
                    {schedule.startTime} - {schedule.endTime}
                  </p>
                  {schedule.breakDuration > 0 && (
                    <p className="text-slate-400 text-xs mt-1">
                      Pausa: {schedule.breakDuration}min (calcolata automaticamente a metà giornata)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
        <p className="text-slate-300 text-sm">
          <strong>Nota:</strong> Una volta completata la registrazione, riceverai le credenziali per accedere al sistema HR.
        </p>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-10">
        <div className="flex items-center justify-center space-x-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                  isCompleted ? 'bg-zinc-800 border-zinc-700 text-white shadow-lg' :
                  isActive ? 'border-zinc-700 text-slate-300 bg-zinc-900' :
                  'border-slate-600 text-slate-400'
                }`}>
                  {isCompleted ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                </div>
                <div className="mt-3 text-center">
                  <p className={`text-sm font-semibold transition-colors duration-300 ${
                    isActive ? 'text-white' : 
                    isCompleted ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    {step.title}
                  </p>
                  <p className={`text-xs mt-1 transition-colors duration-300 ${
                    isActive ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    Step {step.id}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`absolute top-6 left-full w-16 h-0.5 transition-colors duration-300 ${
                    isCompleted ? 'bg-zinc-700' : 'bg-zinc-800'
                  }`} style={{ transform: 'translateX(50%)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-8 border border-slate-700/50 shadow-2xl">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-10 pt-6 border-t border-slate-700/50">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              currentStep === 1 
                ? 'bg-zinc-800/50 text-slate-500 cursor-not-allowed border border-zinc-700/30' 
                : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Indietro
          </button>

          {currentStep < steps.length ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!validateCurrentStep()}
              className={`flex items-center px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg border ${
                validateCurrentStep()
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 hover:shadow-xl border-indigo-500/30'
                  : 'bg-zinc-800/50 text-slate-500 cursor-not-allowed border-zinc-700/30'
              }`}
            >
              Avanti
              <ArrowRight className="h-5 w-5 ml-2" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-green-500/30"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Registrazione...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Completa Registrazione
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default RegistrationSteps;