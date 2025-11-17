import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock,
  Filter,
  Search,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';

const Notifiche = () => {
  const { user, apiCall } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUnread, setFilterUnread] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await apiCall(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      for (const id of unreadIds) {
        await markAsRead(id);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await apiCall(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Naviga alla risorsa correlata se presente
    if (notification.related_id) {
      switch (notification.type) {
        case 'leave_approved':
        case 'leave_rejected':
          // Determina la pagina basata sul messaggio
          if (notification.message.toLowerCase().includes('ferie')) {
            navigate('/ferie');
          } else if (notification.message.toLowerCase().includes('malattia')) {
            navigate('/malattia');
          } else {
            navigate('/permessi');
          }
          break;
        default:
          break;
      }
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'leave_approved':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'leave_rejected':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'leave_pending':
        return <Clock className="h-5 w-5 text-yellow-400" />;
      default:
        return <AlertCircle className="h-5 w-5 text-blue-400" />;
    }
  };

  const getNotificationBg = (type, isRead) => {
    // Mantieni sempre i colori, ma opacità leggermente inferiore se letta
    const opacity = isRead ? '20' : '30';
    const borderOpacity = isRead ? '30' : '50';
    
    switch (type) {
      case 'leave_approved':
        return `bg-green-900/${opacity} border-green-500/${borderOpacity}`;
      case 'leave_rejected':
        return `bg-red-900/${opacity} border-red-500/${borderOpacity}`;
      case 'leave_pending':
        return `bg-yellow-900/${opacity} border-yellow-500/${borderOpacity}`;
      default:
        return `bg-blue-900/${opacity} border-blue-500/${borderOpacity}`;
    }
  };

  const filteredNotifications = filterUnread 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Bell className="h-8 w-8 mr-3 text-indigo-400" />
              Notifiche
            </h1>
            <p className="text-slate-400 mt-2">
              {unreadCount > 0 
                ? `Hai ${unreadCount} notifica${unreadCount > 1 ? 'e' : ''} non letta${unreadCount > 1 ? 'e' : ''}`
                : 'Tutte le notifiche sono state lette'
              }
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Filtro Non Lette */}
            <button
              onClick={() => setFilterUnread(!filterUnread)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                filterUnread
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              {filterUnread ? 'Tutte' : 'Non lette'}
            </button>

            {/* Segna tutte come lette */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Segna tutte come lette
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista Notifiche */}
      <div className="bg-slate-800 rounded-lg p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg">
              {filterUnread 
                ? 'Nessuna notifica non letta'
                : 'Non hai ancora ricevuto notifiche'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-lg ${
                  getNotificationBg(notification.type, notification.is_read)
                } ${!notification.is_read ? 'border-l-4' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white">
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <span className="ml-2 px-2 py-1 bg-indigo-600 text-white text-xs rounded-full">
                            Nuovo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-slate-300" dangerouslySetInnerHTML={{
                        __html: (() => {
                          let msg = notification.message;
                          // Formatta date in formato anglosassone (YYYY-MM-DD) in italiano
                          // Parse as local time to avoid UTC timezone issues
                          msg = msg.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match, year, month, day) => {
                            // Parse as local date (year, month-1, day) to avoid UTC issues
                            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                            return date.toLocaleDateString('it-IT', { 
                              day: '2-digit', 
                              month: 'long', 
                              year: 'numeric',
                              timeZone: 'Europe/Rome'
                            });
                          });
                          // Metti in bold i nomi (Nome Cognome)
                          msg = msg.replace(
                            /(\b[A-Z][a-z]+ [A-Z][a-z]+\b)/g,
                            '<strong class="font-bold text-white">$1</strong>'
                          );
                          return msg;
                        })()
                      }} />
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(notification.created_at).toLocaleString('it-IT', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Rome'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Azioni */}
                  <div className="flex items-center space-x-2 ml-4">
                    {!notification.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        title="Segna come letto"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifiche;

