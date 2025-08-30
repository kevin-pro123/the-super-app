import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { CreditCard, User, FileText } from 'lucide-react-native';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [userType, setUserType] = useState<'adult' | 'child' | 'student' | 'driver'>('adult');
  const [documentNumber, setDocumentNumber] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          Alert.alert('Error', error.message);
        }
      } else {
        if (!fullName || !documentNumber) {
          Alert.alert('Error', 'Por favor completa todos los campos');
          return;
        }

        const { error } = await signUp(
          email,
          password,
          fullName,
          role,
          role === 'driver' ? 'driver' : userType,
          documentNumber
        );

        if (error) {
          Alert.alert('Error', error.message);
        } else {
          Alert.alert('Éxito', 'Cuenta creada exitosamente');
          setIsLogin(true);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <CreditCard size={48} color="#1E40AF" />
        <Text style={styles.title}>TransWallet</Text>
        <Text style={styles.subtitle}>
          {isLogin ? 'Inicia sesión' : 'Crear cuenta'}
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {!isLogin && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Tipo de usuario</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'passenger' && styles.roleButtonActive]}
                onPress={() => setRole('passenger')}
              >
                <User size={20} color={role === 'passenger' ? '#fff' : '#1E40AF'} />
                <Text style={[styles.roleText, role === 'passenger' && styles.roleTextActive]}>
                  Pasajero
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleButton, role === 'driver' && styles.roleButtonActive]}
                onPress={() => setRole('driver')}
              >
                <FileText size={20} color={role === 'driver' ? '#fff' : '#1E40AF'} />
                <Text style={[styles.roleText, role === 'driver' && styles.roleTextActive]}>
                  Conductor
                </Text>
              </TouchableOpacity>
            </View>

            {role === 'passenger' && (
              <>
                <Text style={styles.label}>Categoría</Text>
                <View style={styles.categoryContainer}>
                  {['adult', 'student', 'child'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.categoryButton, userType === type && styles.categoryButtonActive]}
                      onPress={() => setUserType(type as any)}
                    >
                      <Text style={[styles.categoryText, userType === type && styles.categoryTextActive]}>
                        {type === 'adult' ? 'Adulto' : type === 'student' ? 'Estudiante' : 'Niño'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder={
                role === 'driver'
                  ? 'Número de licencia'
                  : userType === 'student'
                  ? 'Carnet de estudiante'
                  : 'Carnet de identidad'
              }
              value={documentNumber}
              onChangeText={setDocumentNumber}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Cargando...' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.switchButtonText}>
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 8,
  },
  form: {
    paddingHorizontal: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E40AF',
    backgroundColor: '#fff',
  },
  roleButtonActive: {
    backgroundColor: '#1E40AF',
  },
  roleText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
  },
  roleTextActive: {
    color: '#fff',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  categoryTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchButtonText: {
    color: '#1E40AF',
    fontSize: 16,
    fontWeight: '500',
  },
});