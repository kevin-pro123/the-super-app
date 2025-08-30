export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'passenger' | 'driver';
  user_type: 'adult' | 'child' | 'student' | 'driver';
  document_number: string;
  balance: number;
  created_at: string;
}

export interface Bus {
  id: string;
  driver_id: string;
  license_plate: string;
  route: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  updated_at: string;
}

export interface Transaction {
  id: string;
  passenger_id: string;
  driver_id: string;
  bus_id: string;
  amount: number;
  passenger_count: {
    adults: number;
    children: number;
    students: number;
  };
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface PaymentRequest {
  id: string;
  passenger_id: string;
  bus_id: string;
  amount: number;
  passenger_count: {
    adults: number;
    children: number;
    students: number;
  };
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}