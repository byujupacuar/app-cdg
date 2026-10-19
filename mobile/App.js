import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './theme';

// Importación de Pantallas
import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import RegistroScreen from './screens/RegistroScreen';
import PresupuestosScreen from './screens/PresupuestosScreen';
import PrestamosScreen from './screens/PrestamosScreen';
import ParejaScreen from './screens/ParejaScreen';
import CategoriasScreen from './screens/CategoriasScreen';
import CuentasScreen from './screens/CuentasScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);

  const handleLoginSuccess = (newToken, user) => {
    setToken(newToken);
    setUsuario(user);
  };

  // Función para cerrar sesión
  const handleLogout = () => {
    setToken(null);
    setUsuario(null);
  };

  if (!token) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" backgroundColor={colors.canvas} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, size }) => {
            const icons = {
              Resumen: '◫',
              Movimientos: '↕',
              Categorías: '◇',
              Cuentas: '▣',
              Presupuestos: '◉',
              Préstamos: '↗',
              Cuenta: '○'
            };
            return (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 26
              }}>
                <Text style={{ color, fontSize: size, fontWeight: '600' }}>
                  {icons[route.name]}
                </Text>
              </View>
            );
          },
          tabBarActiveTintColor: colors.green800,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '700',
            marginBottom: 5
          },
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            height: 64,
            paddingTop: 6,
            elevation: 0
          },
          tabBarItemStyle: {
            borderRadius: 10,
            marginHorizontal: 2,
            marginVertical: 4
          }
        })}
      >
        <Tab.Screen name="Resumen" options={{ tabBarLabel: 'Resumen' }}>
          {(props) => <DashboardScreen {...props} token={token} onLogout={handleLogout} />}
        </Tab.Screen>

        <Tab.Screen name="Movimientos">
          {(props) => <RegistroScreen {...props} token={token} />}
        </Tab.Screen>
        <Tab.Screen name="Categorías">
          {(props) => <CategoriasScreen {...props} token={token} />}
        </Tab.Screen>

        <Tab.Screen name="Cuentas">
          {(props) => <CuentasScreen {...props} token={token} />}
        </Tab.Screen>

        <Tab.Screen name="Presupuestos">
          {(props) => <PresupuestosScreen {...props} token={token} />}
        </Tab.Screen>

        <Tab.Screen name="Préstamos">
          {(props) => <PrestamosScreen {...props} token={token} />}
        </Tab.Screen>

        <Tab.Screen name="Cuenta">
          {(props) => <ParejaScreen {...props} token={token} onLogout={handleLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}