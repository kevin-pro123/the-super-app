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
import { supabase } from '@/lib/supabase';
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
    
    // Subscribe to new payment requests
    const subscription = supabase
      .channel('payment-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payment_requests',
        },
        (payload) => {
          fetchPaymentRequests();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user.id]);

  useEffect(() => {
    if (isOnline && location) {
      updateDriverLocation();
    }
  }, [isOnline, location]);

  const fetchPaymentRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`
          *,
          users!payment_requests_passenger_id_fkey(full_name),
          buses!payment_requests_bus_id_fkey(license_plate, route)
        `)
        .eq('buses.driver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPaymentRequests(data || []);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
    }
  };

  const fetchEarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('driver_id', user.id)
        .eq('status', 'completed');

      if (error) throw error;
      
      const totalEarnings = data?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;
      setEarnings(totalEarnings);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const updateDriverLocation = async () => {
    if (!location || !isOnline) return;

    try {
      // First, get or create the driver's bus
      let { data: buses, error } = await supabase
        .from('buses')
        .select('*')
        .eq('driver_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!buses) {
        // Create new bus entry
        const { error: createError } = await supabase
          .from('buses')
          .insert({
            driver_id: user.id,
            license_plate: `BUS-${user.id.slice(0, 6)}`,
            route: `Ruta ${Math.floor(Math.random() * 100)}`,
            latitude: location.latitude,
            longitude: location.longitude,
            is_active: true,
          });

        if (createError) throw createError;
      } else {
        // Update existing bus location
        const { error: updateError } = await supabase
          .from('buses')
          .update({
            latitude: location.latitude,
            longitude: location.longitude,
            is_active: isOnline,
            updated_at: new Date().toISOString(),
          })
          .eq('id', buses.id);

        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  };

  const handlePaymentRequest = async (requestId: string, accept: boolean) => {
    try {
      if (accept) {
        // Get the payment request details
        const { data: request, error: requestError } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (requestError) throw requestError;

        // Update passenger balance
        const { error: balanceError } = await supabase.rpc(
          'update_passenger_balance',
          {
            passenger_id: request.passenger_id,
            amount: -request.amount
          }
        );

        if (balanceError) throw balanceError;

        // Create transaction
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            passenger_id: request.passenger_id,
            driver_id: user.id,
            bus_id: request.bus_id,
            amount: request.amount,
            passenger_count: request.passenger_count,
            status: 'completed',
          });

        if (transactionError) throw transactionError;

        // Update request status
        const { error: updateError } = await supabase
          .from('payment_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        if (updateError) throw updateError;

        Alert.alert('Pago aceptado', 'El pago ha sido procesado exitosamente');
      } else {
        // Reject payment
        const { error } = await supabase
          .from('payment_requests')
          .update({ status: 'rejected' })
          .eq('id', requestId);

        if (error) throw error;

        Alert.alert('Pago rechazado', 'El pago ha sido rechazado');
      }

      fetchPaymentRequests();
      fetchEarnings();
    } catch (error) {
      console.error('Error handling payment request:', error);
      Alert.alert('Error', 'No se pudo procesar la solicitud');
    }
  };

  const toggleOnlineStatus = (value: boolean) => {
    setIsOnline(value);
    updateDriverLocation();
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