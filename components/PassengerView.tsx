import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { supabase, PRICES } from '@/lib/supabase';
import { useLocation } from '@/hooks/useLocation';
import { Bus, PaymentRequest } from '@/types/database';
import { MapPin, CreditCard, Users, Plus, Minus } from 'lucide-react-native';

interface PassengerViewProps {
  user: any;
  onNavigate: (screen: string) => void;
}

interface PassengerCount {
  adults: number;
  children: number;
  students: number;
}

export default function PassengerView({ user, onNavigate }: PassengerViewProps) {
  const { location } = useLocation();
  const [nearbyBuses, setNearbyBuses] = useState<Bus[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [passengerCount, setPassengerCount] = useState<PassengerCount>({
    adults: user.user_type === 'adult' ? 1 : 0,
    children: user.user_type === 'child' ? 1 : 0,
    students: user.user_type === 'student' ? 1 : 0,
  });

  useEffect(() => {
    fetchNearbyBuses();
    const interval = setInterval(fetchNearbyBuses, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [location]);

  const fetchNearbyBuses = async () => {
    if (!location) return;

    try {
      const { data, error } = await supabase
        .from('buses')
        .select(`
          *,
          users!buses_driver_id_fkey(full_name)
        `)
        .eq('is_active', true);

      if (error) throw error;

      // Calculate distances and sort by proximity
      const busesWithDistance = data?.map((bus: any) => {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          bus.latitude,
          bus.longitude
        );
        return { ...bus, distance };
      }).sort((a, b) => a.distance - b.distance) || [];

      setNearbyBuses(busesWithDistance);
    } catch (error) {
      console.error('Error fetching buses:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const calculateTotal = () => {
    return (
      passengerCount.adults * PRICES.adult +
      passengerCount.children * PRICES.child +
      passengerCount.students * PRICES.student
    );
  };

  const updatePassengerCount = (type: keyof PassengerCount, increment: boolean) => {
    setPassengerCount(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + (increment ? 1 : -1))
    }));
  };

  const handlePayment = async () => {
    if (!selectedBus) return;

    const total = calculateTotal();
    
    if (total === 0) {
      Alert.alert('Error', 'Selecciona al menos un pasajero');
      return;
    }

    if (user.balance < total) {
      Alert.alert('Saldo insuficiente', 'No tienes suficiente saldo para realizar este pago');
      return;
    }

    try {
      // Create payment request
      const { error } = await supabase
        .from('payment_requests')
        .insert({
          passenger_id: user.id,
          bus_id: selectedBus.id,
          amount: total,
          passenger_count: passengerCount,
          status: 'pending',
        });

      if (error) throw error;

      Alert.alert('Solicitud enviada', 'Tu solicitud de pago ha sido enviada al conductor');
      setShowPaymentModal(false);
      setSelectedBus(null);
    } catch (error) {
      console.error('Error creating payment request:', error);
      Alert.alert('Error', 'No se pudo procesar el pago');
    }
  };

  const renderBusItem = ({ item }: { item: Bus }) => (
    <TouchableOpacity
      style={styles.busCard}
      onPress={() => {
        setSelectedBus(item);
        setShowPaymentModal(true);
      }}
    >
      <View style={styles.busHeader}>
        <View style={styles.busInfo}>
          <Text style={styles.busRoute}>{item.route}</Text>
          <Text style={styles.busPlate}>{item.license_plate}</Text>
          <Text style={styles.driverName}>{(item as any).users?.full_name}</Text>
        </View>
        <View style={styles.distanceContainer}>
          <MapPin size={16} color="#059669" />
          <Text style={styles.distance}>{item.distance?.toFixed(1)} km</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.payButton}>
        <CreditCard size={20} color="#fff" />
        <Text style={styles.payButtonText}>Pagar Pasaje</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mi Saldo</Text>
        <Text style={styles.balance}>S/. {user.balance?.toFixed(2)}</Text>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onNavigate('deposit')}
          >
            <Plus size={20} color="#059669" />
            <Text style={styles.actionButtonText}>Depositar</Text>
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

      <View style={styles.busesSection}>
        <Text style={styles.sectionTitle}>Buses Cercanos</Text>
        <FlatList
          data={nearbyBuses}
          renderItem={renderBusItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmar Pago</Text>
            
            {selectedBus && (
              <View style={styles.selectedBusInfo}>
                <Text style={styles.selectedBusRoute}>{selectedBus.route}</Text>
                <Text style={styles.selectedBusPlate}>{selectedBus.license_plate}</Text>
              </View>
            )}

            <View style={styles.passengerSelection}>
              <Text style={styles.selectionTitle}>Seleccionar Pasajeros</Text>
              
              <View style={styles.passengerRow}>
                <Text style={styles.passengerType}>Adultos (S/. {PRICES.adult})</Text>
                <View style={styles.counter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('adults', false)}
                  >
                    <Minus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                  <Text style={styles.counterText}>{passengerCount.adults}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('adults', true)}
                  >
                    <Plus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passengerRow}>
                <Text style={styles.passengerType}>Estudiantes (S/. {PRICES.student})</Text>
                <View style={styles.counter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('students', false)}
                  >
                    <Minus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                  <Text style={styles.counterText}>{passengerCount.students}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('students', true)}
                  >
                    <Plus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passengerRow}>
                <Text style={styles.passengerType}>Niños (S/. {PRICES.child})</Text>
                <View style={styles.counter}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('children', false)}
                  >
                    <Minus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                  <Text style={styles.counterText}>{passengerCount.children}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updatePassengerCount('children', true)}
                  >
                    <Plus size={16} color="#1E40AF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.totalSection}>
              <Text style={styles.totalText}>Total: S/. {calculateTotal().toFixed(2)}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handlePayment}
              >
                <Text style={styles.confirmButtonText}>Confirmar Pago</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  balance: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    marginVertical: 8,
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
  busesSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  busCard: {
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
  busHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  busInfo: {
    flex: 1,
  },
  busRoute: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
  },
  busPlate: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  driverName: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distance: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    marginLeft: 4,
  },
  payButton: {
    backgroundColor: '#1E40AF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  selectedBusInfo: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  selectedBusRoute: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
  },
  selectedBusPlate: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  passengerSelection: {
    marginBottom: 24,
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  passengerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  passengerType: {
    fontSize: 16,
    color: '#374151',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
    marginHorizontal: 16,
  },
  totalSection: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});