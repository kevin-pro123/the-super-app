import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { QrCode, ArrowLeft, DollarSign } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface WithdrawScreenProps {
  user: any;
  onBack: () => void;
}

export default function WithdrawScreen({ user, onBack }: WithdrawScreenProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate available earnings from completed transactions
  const [availableEarnings, setAvailableEarnings] = React.useState(0);

  React.useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('driver_id', user.id)
        .eq('status', 'completed');

      if (error) throw error;
      
      const totalEarnings = data?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;
      setAvailableEarnings(totalEarnings);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const amounts = [50, 100, 200, 500, 1000];
  const availableAmounts = amounts.filter(amount => amount <= availableEarnings);

  const handleWithdraw = async () => {
    if (!selectedAmount) {
      Alert.alert('Error', 'Selecciona un monto para retirar');
      return;
    }

    if (selectedAmount > availableEarnings) {
      Alert.alert('Error', 'No tienes suficientes ganancias para retirar este monto');
      return;
    }

    setLoading(true);

    try {
      // In a real app, you would integrate with a payment provider
      // For demo purposes, we'll simulate the withdrawal
      Alert.alert(
        'Retiro solicitado', 
        `Se procesará el retiro de S/. ${selectedAmount} en las próximas 24 horas. Recibirás una notificación cuando esté disponible en tu cuenta bancaria.`
      );
      
      setSelectedAmount(null);
      onBack();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      Alert.alert('Error', 'No se pudo procesar el retiro');
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
        <Text style={styles.title}>Retirar Ganancias</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.earningsSection}>
          <DollarSign size={48} color="#059669" />
          <Text style={styles.earningsTitle}>Ganancias Disponibles</Text>
          <Text style={styles.earningsAmount}>S/. {availableEarnings.toFixed(2)}</Text>
          <Text style={styles.earningsSubtitle}>
            Dinero disponible para retirar
          </Text>
        </View>

        {availableEarnings > 0 ? (
          <>
            <View style={styles.amountSection}>
              <Text style={styles.sectionTitle}>Seleccionar Monto</Text>
              <View style={styles.amountGrid}>
                {availableAmounts.map((amount) => (
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
                
                {/* Custom amount button */}
                <TouchableOpacity
                  style={[
                    styles.amountButton,
                    styles.customAmountButton,
                    selectedAmount === availableEarnings && styles.amountButtonSelected
                  ]}
                  onPress={() => setSelectedAmount(availableEarnings)}
                >
                  <Text
                    style={[
                      styles.amountText,
                      styles.customAmountText,
                      selectedAmount === availableEarnings && styles.amountTextSelected
                    ]}
                  >
                    Todo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.withdrawalInfo}>
              <Text style={styles.infoTitle}>Información de Retiro</Text>
              <Text style={styles.infoText}>
                • Los retiros se procesan en 1-2 días hábiles
              </Text>
              <Text style={styles.infoText}>
                • Se depositará en tu cuenta bancaria registrada
              </Text>
              <Text style={styles.infoText}>
                • No hay comisiones por retiros
              </Text>
            </View>

            {selectedAmount && (
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Monto a retirar:</Text>
                  <Text style={styles.summaryValue}>S/. {selectedAmount.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Ganancias restantes:</Text>
                  <Text style={styles.totalValue}>
                    S/. {(availableEarnings - selectedAmount).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.withdrawButton,
                (!selectedAmount || loading) && styles.withdrawButtonDisabled
              ]}
              onPress={handleWithdraw}
              disabled={!selectedAmount || loading}
            >
              <Text style={styles.withdrawButtonText}>
                {loading ? 'Procesando...' : 'Solicitar Retiro'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.noEarningsState}>
            <Text style={styles.noEarningsText}>No tienes ganancias disponibles</Text>
            <Text style={styles.noEarningsSubtext}>
              Acepta pagos de pasajeros para generar ganancias
            </Text>
          </View>
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
  earningsSection: {
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
  earningsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginTop: 16,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 8,
  },
  earningsSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
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
  customAmountButton: {
    width: (Dimensions.get('window').width - 120) / 3,
  },
  amountButtonSelected: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  customAmountText: {
    fontSize: 14,
  },
  amountTextSelected: {
    color: '#fff',
  },
  withdrawalInfo: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#065f46',
    marginBottom: 6,
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
    color: '#059669',
  },
  withdrawButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  withdrawButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  withdrawButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  noEarningsState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noEarningsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  noEarningsSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
});