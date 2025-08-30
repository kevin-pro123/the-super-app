import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { QrCode, ArrowLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface DepositScreenProps {
  user: any;
  onBack: () => void;
}

export default function DepositScreen({ user, onBack }: DepositScreenProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const amounts = [10, 20, 50, 100, 200, 500];

  const handleDeposit = async () => {
    if (!selectedAmount) {
      Alert.alert('Error', 'Selecciona un monto para depositar');
      return;
    }

    setLoading(true);

    try {
      // Update user balance
      const { error } = await supabase.rpc(
        'update_passenger_balance',
        {
          passenger_id: user.id,
          amount: selectedAmount
        }
      );

      if (error) throw error;

      Alert.alert('Depósito exitoso', `Se depositaron S/. ${selectedAmount} a tu cuenta`);
      setSelectedAmount(null);
      onBack();
    } catch (error) {
      console.error('Error making deposit:', error);
      Alert.alert('Error', 'No se pudo procesar el depósito');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <Text style={styles.title}>Depositar Fondos</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.qrSection}>
          <QrCode size={120} color="#1E40AF" />
          <Text style={styles.qrTitle}>Código QR para Depósito</Text>
          <Text style={styles.qrSubtitle}>
            Escanea este código en cualquier agente autorizado
          </Text>
        </View>

        <View style={styles.amountSection}>
          <Text style={styles.sectionTitle}>Seleccionar Monto</Text>
          <View style={styles.amountGrid}>
            {amounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.amountButton,
                  selectedAmount === amount && styles.amountButtonSelected
                ]}
                onPress={() => setSelectedAmount(amount)}
              >
                <Text
                  style={[
                    styles.amountText,
                    selectedAmount === amount && styles.amountTextSelected
                  ]}
                >
                  S/. {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Saldo actual:</Text>
            <Text style={styles.summaryValue}>S/. {user.balance?.toFixed(2)}</Text>
          </View>
          {selectedAmount && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Monto a depositar:</Text>
                <Text style={styles.summaryValue}>S/. {selectedAmount.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Nuevo saldo:</Text>
                <Text style={styles.totalValue}>
                  S/. {(user.balance + selectedAmount).toFixed(2)}
                </Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.depositButton,
            (!selectedAmount || loading) && styles.depositButtonDisabled
          ]}
          onPress={handleDeposit}
          disabled={!selectedAmount || loading}
        >
          <Text style={styles.depositButtonText}>
            {loading ? 'Procesando...' : 'Confirmar Depósito'}
          </Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#1E40AF',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  qrSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
    marginTop: 16,
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  amountSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amountButton: {
    width: (Dimensions.get('window').width - 120) / 3,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  amountButtonSelected: {
    borderColor: '#1E40AF',
    backgroundColor: '#1E40AF',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  amountTextSelected: {
    color: '#fff',
  },
  summary: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  depositButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  depositButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  depositButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});