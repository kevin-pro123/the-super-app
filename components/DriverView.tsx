import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Switch,
} from 'react-native';
import { api } from '@/lib/api';
import { useLocation } from '@/hooks/useLocation';
import { PaymentRequest } from '@/types/database';
import { Bell, DollarSign, Users, MapPin } from 'lucide-react-native';

interface DriverViewProps {
  user: any;
  onNavigate: (screen: string) => void;
}

export default function DriverView({ user, onNavigate }: DriverViewProps) {
  const { location } = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [earnings, setEarnings] = useState(0);

  useEffect(() => {
    fetchPaymentRequests();
    fetchEarnings();

    // Revisar nuevas solicitudes de pago cada 5 segundos
    const interval = setInterval(fetchPaymentRequests, 5000);
    return () => clearInterval(interval);
  }, [user.id]);

  useEffect(() => {
    if (isOnline && location) {
      updateDriverLocation(true);
    }
  }, [isOnline, location]);

  const fetchPaymentRequests = async () => {
    try {
      const data = await api<PaymentRequest[]>('/payment-requests/pending');
      setPaymentRequests(data || []);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
    }
  };

  const fetchEarnings = async () => {
    try {
      const data = await api<{ total: number }>('/transactions/earnings');
      setEarnings(data.total);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const updateDriverLocation = async (online: boolean) => {
    if (!location) return;

    try {
      // Crea el bus del conductor si no existe, o actualiza su ubicación
      await api('/buses/me', {
        method: 'PUT',
        body: {
          latitude: location.latitude,
          longitude: location.longitude,
          is_active: online,
        },
      });
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  };

  const handlePaymentRequest = async (requestId: string, accept: boolean) => {
    try {
      await api(`/payment-requests/${requestId}/${accept ? 'accept' : 'reject'}`, {
        method: 'POST',
      });

      if (accept) {
        Alert.alert('Pago aceptado', 'El pago ha sido procesado exitosamente');
      } else {
        Alert.alert('Pago rechazado', 'El pago ha sido rechazado');
      }
    } catch (error) {
      console.error('Error handling payment request:', error);
      Alert.alert('Error', (error as Error).message || 'No se pudo procesar la solicitud');
    } finally {
      fetchPaymentRequests();
      fetchEarnings();
    }
  };

  const toggleOnlineStatus = (value: boolean) => {
    setIsOnline(value);
    updateDriverLocation(value);
  };

  const renderPaymentRequest = ({ item }: { item: any }) => (
    <View style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>{item.users?.full_name}</Text>
          <Text style={styles.busInfo}>{item.buses?.route} - {item.buses?.license_plate}</Text>
        </View>
        <Text style={styles.amount}>S/. {item.amount.toFixed(2)}</Text>
      </View>
      
      <View style={styles.passengerCount}>
        {item.passenger_count.adults > 0 && (
          <Text style={styles.countText}>Adultos: {item.passenger_count.adults}</Text>
        )}
        {item.passenger_count.students > 0 && (
          <Text style={styles.countText}>Estudiantes: {item.passenger_count.students}</Text>
        )}
        {item.passenger_count.children > 0 && (
          <Text style={styles.countText}>Niños: {item.passenger_count.children}</Text>
        )}
      </View>

      <View style={styles.paymentActions}>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handlePaymentRequest(item.id, false)}
        >
          <Text style={styles.rejectButtonText}>Rechazar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handlePaymentRequest(item.id, true)}
        >
          <Text style={styles.acceptButtonText}>Aceptar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ganancias de Hoy</Text>
        <Text style={styles.earnings}>S/. {earnings.toFixed(2)}</Text>
        
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>Estado:</Text>
            <View style={styles.statusIndicator}>
              <Text style={[styles.statusLabel, { color: isOnline ? '#059669' : '#dc2626' }]}>
                {isOnline ? 'En línea' : 'Fuera de línea'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={toggleOnlineStatus}
                trackColor={{ false: '#e5e7eb', true: '#dcfce7' }}
                thumbColor={isOnline ? '#059669' : '#6b7280'}
              />
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onNavigate('withdraw')}
          >
            <DollarSign size={20} color="#059669" />
            <Text style={styles.actionButtonText}>Retirar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onNavigate('profile')}
          >
            <Users size={20} color="#1E40AF" />
            <Text style={styles.actionButtonText}>Perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.requestsSection}>
        <View style={styles.sectionHeader}>
          <Bell size={20} color="#1E40AF" />
          <Text style={styles.sectionTitle}>Solicitudes de Pago</Text>
          {paymentRequests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{paymentRequests.length}</Text>
            </View>
          )}
        </View>

        {paymentRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={48} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No hay solicitudes de pago</Text>
            <Text style={styles.emptyStateSubtext}>
              {isOnline ? 'Las nuevas solicitudes aparecerán aquí' : 'Actívate para recibir solicitudes'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={paymentRequests}
            renderItem={renderPaymentRequest}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
  },
  earnings: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#059669',
    textAlign: 'center',
    marginVertical: 8,
  },
  statusContainer: {
    marginVertical: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#1E40AF',
  },
  requestsSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  badge: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
  },
  busInfo: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  passengerCount: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  countText: {
    fontSize: 12,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});