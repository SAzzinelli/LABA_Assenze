import React, { useState } from 'react';
import { useAuthStore } from '../utils/store';
import { User, Mail, Phone, Calendar, Briefcase, Edit, Save, X } from 'lucide-react';

const Profile = () => {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    birthDate: user?.birthDate || '',
    department: user?.department || '',
    has104: user?.has104 || false
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = () => {
    // Qui implementeremo la logica per salvare le modifiche
    console.log('Saving profile:', formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      birthDate: user?.birthDate || '',
      department: user?.department || '',
      has104: user?.has104 || false
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <User className="h-8 w-8 mr-3 text-purple-400" />
              Profilo Utente
            </h1>
            <p className="text-slate-400 mt-2">
              Gestisci le tue informazioni personali
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salva
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                >
                  <X className="h-4 w-4 mr-2" />
                  Annulla
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
              >
                <Edit className="h-4 w-4 mr-2" />
                Modifica
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar and Basic Info */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="text-center">
              <div className="h-24 w-24 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-slate-400 capitalize">
                {user?.role?.replace('_', ' ')}
              </p>
              <p className="text-slate-400 mt-1">
                {user?.department}
              </p>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Informazioni Personali</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-white">{user?.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Cognome
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-white">{user?.lastName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-white">{user?.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                  <Phone className="h-4 w-4 mr-2" />
                  Telefono
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-white">{user?.phone || 'Non specificato'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Data di Nascita
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-white">
                    {user?.birthDate ? new Date(user.birthDate).toLocaleDateString('it-IT') : 'Non specificata'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Dipartimento
                </label>
                {isEditing ? (
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Seleziona dipartimento</option>
                    <option value="Amministrazione">Amministrazione</option>
                    <option value="Segreteria">Segreteria</option>
                    <option value="Orientamento">Orientamento</option>
                    <option value="Reparto IT">Reparto IT</option>
                  </select>
                ) : (
                  <p className="text-white">{user?.department}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="has104"
                  checked={formData.has104}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-slate-300">
                  Beneficiario Legge 104
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Informazioni Account</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ruolo
            </label>
            <p className="text-white capitalize">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Data Registrazione
            </label>
            <p className="text-white">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('it-IT') : 'Non disponibile'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;