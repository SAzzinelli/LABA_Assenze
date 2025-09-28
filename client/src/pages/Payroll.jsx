import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { DollarSign, Download, Calendar, User, TrendingUp, TrendingDown, Eye } from 'lucide-react';

const Payroll = () => {
  const { user, apiCall } = useAuthStore();
  const [payrollData, setPayrollData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    fetchPayrollData();
    if (user?.role === 'admin') {
      fetchSummary();
    }
  }, [selectedYear, selectedMonth]);

  const fetchPayrollData = async () => {
    try {
      setLoading(true);
      const response = await apiCall(`/api/payroll?year=${selectedYear}&month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setPayrollData(data);
      }
    } catch (error) {
      console.error('Error fetching payroll data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await apiCall('/api/payroll/summary');
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching payroll summary:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getPayrollStatus = (status) => {
    const statusMap = {
      'paid': { label: 'Pagato', color: 'bg-green-600 text-white' },
      'pending': { label: 'In Attesa', color: 'bg-yellow-600 text-white' },
      'processing': { label: 'In Elaborazione', color: 'bg-blue-600 text-white' }
    };
    return statusMap[status] || { label: 'Sconosciuto', color: 'bg-gray-600 text-white' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Caricamento dati payroll...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Payroll</h1>
          <p className="text-slate-400 mt-1">Gestione stipendi e compensi</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {months.map((month, index) => (
              <option key={index + 1} value={index + 1}>{month}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Admin Summary */}
      {user?.role === 'admin' && summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totale Lordo</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalGross)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totale Netto</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalNet)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totale Tasse</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalTaxes)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Dipendenti</p>
                <p className="text-2xl font-bold text-white">{summary.employeeCount}</p>
              </div>
              <User className="h-8 w-8 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">
            Stipendi {months[selectedMonth - 1]} {selectedYear}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                {user?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Dipendente
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Stipendio Lordo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Tasse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Detrazioni
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Stipendio Netto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {payrollData.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 7 : 6} className="px-6 py-8 text-center text-slate-400">
                    Nessun dato payroll disponibile per {months[selectedMonth - 1]} {selectedYear}
                  </td>
                </tr>
              ) : (
                payrollData.map((item) => {
                  const status = getPayrollStatus(item.status);
                  return (
                    <tr key={item.id} className="hover:bg-slate-700/50 transition-colors">
                      {user?.role === 'admin' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 bg-indigo-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {item.users?.first_name?.[0]}{item.users?.last_name?.[0]}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">
                                {item.users?.first_name} {item.users?.last_name}
                              </div>
                              <div className="text-sm text-slate-400">{item.users?.email}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-semibold">
                        {formatCurrency(item.gross_salary)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400">
                        {formatCurrency(item.taxes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-400">
                        {formatCurrency(item.deductions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400 font-semibold">
                        {formatCurrency(item.net_salary)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button className="text-indigo-400 hover:text-indigo-300 flex items-center">
                            <Eye className="h-4 w-4 mr-1" />
                            Dettagli
                          </button>
                          <button className="text-green-400 hover:text-green-300 flex items-center">
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Payroll;
