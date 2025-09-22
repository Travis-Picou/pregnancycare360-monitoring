/**
 * PregnancyCare 360 - Mobile Application
 * 
 * React Native mobile app for pregnancy monitoring and patient engagement.
 * Provides real-time vital signs tracking, risk assessment viewing, and care coordination.
 */

import React, { useEffect, useState } from 'react';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { StatusBar, Platform, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { enableScreens } from 'react-native-screens';
import SplashScreen from 'react-native-splash-screen';
import PushNotification from 'react-native-push-notification';
import BackgroundJob from 'react-native-background-job';

// Redux store
import { store, persistor } from './store';

// Screens
import LoadingScreen from './screens/LoadingScreen';
import AuthNavigator from './navigation/AuthNavigator';
import DashboardScreen from './screens/DashboardScreen';
import VitalSignsScreen from './screens/VitalSignsScreen';
import AppointmentsScreen from './screens/AppointmentsScreen';
import EducationScreen from './screens/EducationScreen';
import ProfileScreen from './screens/ProfileScreen';
import RiskAssessmentScreen from './screens/RiskAssessmentScreen';
import VitalSignsEntryScreen from './screens/VitalSignsEntryScreen';
import AppointmentDetailsScreen from './screens/AppointmentDetailsScreen';
import NotificationsScreen from './screens/NotificationsScreen';

// Services
import { AuthService } from './services/AuthService';
import { VitalSignsService } from './services/VitalSignsService';
import { NotificationService } from './services/NotificationService';
import { HealthKitService } from './services/HealthKitService';
import { DeviceService } from './services/DeviceService';

// Hooks
import { useAppSelector, useAppDispatch } from './hooks/redux';
import { useNetworkStatus } from './hooks/useNetworkStatus';

// Actions
import { setUser, clearUser } from './store/slices/authSlice';
import { setNetworkStatus } from './store/slices/appSlice';

// Types
import { RootStackParamList, TabParamList } from './types/navigation';

// Theme
import { ThemeProvider } from './contexts/ThemeContext';
import { theme } from './theme';

// Enable screens for better performance
enableScreens();

// Navigation
const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ============================================================================
// TAB NAVIGATOR
// ============================================================================

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'VitalSigns':
              iconName = 'favorite';
              break;
            case 'Appointments':
              iconName = 'event';
              break;
            case 'Education':
              iconName = 'school';
              break;
            case 'Profile':
              iconName = 'person';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          height: Platform.OS === 'ios' ? 85 : 60,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="VitalSigns" 
        component={VitalSignsScreen}
        options={{ title: 'Vital Signs' }}
      />
      <Tab.Screen 
        name="Appointments" 
        component={AppointmentsScreen}
        options={{ title: 'Appointments' }}
      />
      <Tab.Screen 
        name="Education" 
        component={EducationScreen}
        options={{ title: 'Education' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector(state => state.auth);
  const { isConnected } = useNetworkStatus();
  
  const [isInitialized, setIsInitialized] = useState(false);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    dispatch(setNetworkStatus(isConnected));
  }, [isConnected, dispatch]);

  const initializeApp = async () => {
    try {
      // Hide splash screen
      SplashScreen.hide();

      // Initialize services
      await initializeServices();

      // Check authentication status
      await checkAuthStatus();

      // Setup background tasks
      setupBackgroundTasks();

      // Setup push notifications
      setupPushNotifications();

      setIsInitialized(true);
    } catch (error) {
      console.error('App initialization failed:', error);
      Alert.alert(
        'Initialization Error',
        'Failed to initialize the app. Please restart the application.',
        [{ text: 'OK' }]
      );
    }
  };

  const initializeServices = async () => {
    try {
      // Initialize HealthKit (iOS only)
      if (Platform.OS === 'ios') {
        await HealthKitService.initialize();
      }

      // Initialize device services
      await DeviceService.initialize();

      // Initialize notification service
      await NotificationService.initialize();

      console.log('Services initialized successfully');
    } catch (error) {
      console.error('Service initialization failed:', error);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const user = await AuthService.getCurrentUser();
      if (user) {
        dispatch(setUser(user));
      } else {
        dispatch(clearUser());
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      dispatch(clearUser());
    }
  };

  const setupBackgroundTasks = () => {
    // Background vital signs sync
    BackgroundJob.register({
      jobKey: 'vitalSignsSync',
      period: 15000, // 15 seconds
    });

    BackgroundJob.on('vitalSignsSync', async () => {
      try {
        if (isAuthenticated) {
          await VitalSignsService.syncPendingData();
        }
      } catch (error) {
        console.error('Background vital signs sync failed:', error);
      }
    });

    // Background health data sync (iOS)
    if (Platform.OS === 'ios') {
      BackgroundJob.register({
        jobKey: 'healthKitSync',
        period: 30000, // 30 seconds
      });

      BackgroundJob.on('healthKitSync', async () => {
        try {
          if (isAuthenticated) {
            await HealthKitService.syncHealthData();
          }
        } catch (error) {
          console.error('Background HealthKit sync failed:', error);
        }
      });
    }
  };

  const setupPushNotifications = () => {
    // Configure push notifications
    PushNotification.configure({
      onRegister: async (token) => {
        console.log('Push notification token:', token);
        try {
          await NotificationService.registerDevice(token.token);
        } catch (error) {
          console.error('Failed to register push token:', error);
        }
      },

      onNotification: (notification) => {
        console.log('Push notification received:', notification);
        
        // Handle notification based on type
        if (notification.data?.type === 'high_risk_alert') {
          Alert.alert(
            'High Risk Alert',
            notification.message,
            [
              { text: 'View Details', onPress: () => handleHighRiskAlert(notification.data) },
              { text: 'OK' }
            ]
          );
        } else if (notification.data?.type === 'appointment_reminder') {
          Alert.alert(
            'Appointment Reminder',
            notification.message,
            [
              { text: 'View Appointment', onPress: () => handleAppointmentReminder(notification.data) },
              { text: 'OK' }
            ]
          );
        }

        // Mark notification as received
        NotificationService.markNotificationReceived(notification.data?.notificationId);
      },

      onAction: (notification) => {
        console.log('Notification action:', notification.action);
      },

      onRegistrationError: (err) => {
        console.error('Push notification registration error:', err.message);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  };

  const handleHighRiskAlert = (data: any) => {
    // Navigate to risk assessment screen
    // This would be handled by navigation service
    console.log('Handling high risk alert:', data);
  };

  const handleAppointmentReminder = (data: any) => {
    // Navigate to appointment details
    console.log('Handling appointment reminder:', data);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.primary}
        translucent={false}
      />
      
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.primary,
          },
          headerTintColor: theme.colors.white,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {isAuthenticated ? (
          // Authenticated screens
          <>
            <Stack.Screen
              name="Main"
              component={TabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RiskAssessment"
              component={RiskAssessmentScreen}
              options={{ title: 'Risk Assessment' }}
            />
            <Stack.Screen
              name="VitalSignsEntry"
              component={VitalSignsEntryScreen}
              options={{ title: 'Record Vital Signs' }}
            />
            <Stack.Screen
              name="AppointmentDetails"
              component={AppointmentDetailsScreen}
              options={{ title: 'Appointment Details' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Notifications' }}
            />
          </>
        ) : (
          // Authentication screens
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// ============================================================================
// ROOT APP COMPONENT
// ============================================================================

const App: React.FC = () => {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={<LoadingScreen />} persistor={persistor}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </SafeAreaProvider>
      </PersistGate>
    </ReduxProvider>
  );
};

export default App;