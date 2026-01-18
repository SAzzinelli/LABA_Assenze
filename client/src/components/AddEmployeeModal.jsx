import React, { useState } from 'react';
import { User, Building2, CheckCircle, ArrowLeft, ArrowRight, X, Calendar, MapPin, FileText } from 'lucide-react';

const AddEmployeeModal = ({ isOpen, onClose, onAddEmployee, loading, onError }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Informazioni Personali (stesso ordine della registrazione)
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
    role: 'employee', // Nuovo campo per il ruolo
    
    // Step 3: Orario di Lavoro (aggiunto come nella registrazione)
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

  const departments = ['Amministrazione', 'Segreteria', 'Orientamento', 'Reparto IT'];
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
               formData.contractType &&
               formData.role;
      case 3:
        // Verifica che almeno un giorno sia selezionato come lavorativo
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
      if (onError) onError('Le password non corrispondono');
      return;
    }
    if (formData.email !== formData.confirmEmail) {
      if (onError) onError('Le email non corrispondono');
      return;
    }
    onAddEmployee(formData);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      confirmEmail: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      birthDate: '',
      phone: '',
      has104: false,
      department: '',
      workplace: '',
      contractType: '',
      role: 'employee'
    });
    setCurrentStep(1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <User className="h-12 w-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Informazioni Personali</h3>
        <p className="text-slate-400">Inserisci i dati personali del dipendente</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Nome *</label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Cognome *</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Data di Nascita *</label>
          <input
            type="date"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="nome.cognome@labafirenze.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Conferma Email *</label>
          <input
            type="email"
            name="confirmEmail"
            value={formData.confirmEmail}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="conferma la tua email"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Password *</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Conferma Password *</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Telefono *</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Telefono *</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          className="h-4 w-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
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
        <Building2 className="h-12 w-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Informazioni Lavorative</h3>
        <p className="text-slate-400">Inserisci i dati lavorativi del dipendente</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Dipartimento *</label>
          <div className="relative">
            <select
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer custom-select"
              required
            >
              <option value="">Seleziona dipartimento</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
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
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer custom-select"
              required
            >
              <option value="">Seleziona sede</option>
              {workplaces.map(workplace => (
                <option key={workplace.value} value={workplace.value}>{workplace.label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
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
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer custom-select"
              required
            >
              <option value="">Seleziona tipo contratto</option>
              {contractTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-2">Ruolo *</label>
          <div className="relative">
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer custom-select"
              required
            >
              <option value="employee">Dipendente</option>
              <option value="supervisor">Supervisore</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            I Supervisori hanno gli stessi privilegi degli amministratori
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Calendar className="h-12 w-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Orario di Lavoro</h3>
        <p className="text-slate-400">Configura l'orario di lavoro settimanale del dipendente</p>
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
            <div key={day} className="bg-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">{dayNames[day]}</h4>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.isWorking}
                    onChange={(e) => handleWorkScheduleChange(day, 'isWorking', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
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
                      className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Ora Fine</label>
                    <input
                      type="time"
                      value={schedule.endTime}
                      onChange={(e) => handleWorkScheduleChange(day, 'endTime', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Pausa Pranzo (min)</label>
                    <select
                      value={schedule.breakDuration}
                      onChange={(e) => handleWorkScheduleChange(day, 'breakDuration', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer custom-select"
                    >
                      <option value={0}>Nessuna pausa</option>
                      <option value={30}>30 minuti</option>
                      <option value={60}>1 ora</option>
                      <option value={90}>1 ora e 30 min</option>
                      <option value={120}>2 ore</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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

      <div className="bg-slate-700 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-400" />
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
              <Building2 className="h-5 w-5 mr-2 text-blue-400" />
              Informazioni Lavorative
            </h4>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-400">Dipartimento:</span> <span className="text-white">{formData.department}</span></p>
              <p><span className="text-slate-400">Sede:</span> <span className="text-white">{workplaces.find(w => w.value === formData.workplace)?.label}</span></p>
              <p><span className="text-slate-400">Contratto:</span> <span className="text-white">{formData.contractType}</span></p>
              <p><span className="text-slate-400">Ruolo:</span> <span className={`font-semibold ${
                formData.role === 'supervisor' ? 'text-purple-400' : 'text-white'
              }`}>
                {formData.role === 'supervisor' ? 'SUPERVISORE' : 'Dipendente'}
              </span></p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-indigo-400" />
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

              return (
                <div key={day} className="bg-slate-600 rounded-lg p-3">
                  <h5 className="font-medium text-white mb-2">{dayNames[day]}</h5>
                  {schedule.isWorking ? (
                    <div className="text-sm text-slate-300">
                      <p>{schedule.startTime} - {schedule.endTime}</p>
                      {schedule.breakDuration > 0 && (
                        <p className="text-slate-400">Pausa: {schedule.breakDuration} min</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">Non lavorativo</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-950 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-900">
          <div>
            <h2 className="text-2xl font-bold text-white">Aggiungi Dipendente</h2>
            <p className="text-slate-400 mt-1">Step {currentStep} di {steps.length}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 border-b border-zinc-900">
          <div className="flex items-center justify-center space-x-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                    isCompleted ? 'bg-gradient-to-r from-blue-500 to-blue-700 border-blue-600 text-white shadow-lg' :
                    isActive ? 'border-blue-600 text-blue-600 bg-blue-600/20' :
                    'border-slate-600 text-slate-400'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                  </div>
                  <div className="mt-3 text-center">
                    <p className={`text-sm font-semibold transition-colors duration-300 ${
                      isActive ? 'text-white' : 
                      isCompleted ? 'text-indigo-400' : 'text-slate-400'
                    }`}>
                      {step.title}
                    </p>
                    <p className={`text-xs mt-1 transition-colors duration-300 ${
                      isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      Step {step.id}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`px-6 py-2 rounded-lg transition-colors flex items-center ${
                currentStep === 1 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                  : 'bg-slate-600 hover:bg-slate-500 text-white'
              }`}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Indietro
            </button>

            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!validateCurrentStep()}
                className={`px-6 py-2 rounded-lg transition-colors flex items-center ${
                  validateCurrentStep()
                    ? 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                }`}
              >
                Avanti
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Aggiungendo...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aggiungi Dipendente
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEmployeeModal;
