import React, { useEffect, useState } from 'react';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { colors } from './theme';
import { clearSession, getPendingMutationCount, loadSession, saveSession } from './database/offlineStore';
import { prepararDatosOffline, sincronizarPendientes } from './api';

// Importación de Pantallas
import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import RegistroScreen from './screens/RegistroScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import PresupuestosScreen from './screens/PresupuestosScreen';
import PrestamosScreen from './screens/PrestamosScreen';
import ParejaScreen from './screens/ParejaScreen';
import CategoriasScreen from './screens/CategoriasScreen';
import CuentasScreen from './screens/CuentasScreen';
import PerfilScreen from './screens/PerfilScreen';

const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

export default function App() {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [restaurandoSesion, setRestaurandoSesion] = useState(true);
  const [conexionDisponible, setConexionDisponible] = useState(null);
  const [cambiosPendientes, setCambiosPendientes] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    let activa = true;
    loadSession()
      .then((sesion) => {
        if (!activa || !sesion) return;
        setToken(sesion.token);
        setUsuario(sesion.user);
      })
      .catch((error) => {
        console.error('No se pudo restaurar la sesión local:', error);
      })
      .finally(() => {
        if (activa) setRestaurandoSesion(false);
      });
    return () => { activa = false; };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let activa = true;
    const actualizarPendientes = async () => {
      try {
        const pendientes = await getPendingMutationCount();
        if (activa) setCambiosPendientes(pendientes);
      } catch (error) {
        console.error('No se pudo consultar la cola offline:', error);
      }
    };
    const sincronizarYActualizar = async () => {
      try {
        await sincronizarPendientes(token);
        await prepararDatosOffline(token);
        await actualizarPendientes();
      } catch (error) {
        console.error('No se pudo completar la sincronización offline:', error);
      }
    };
    actualizarPendientes();
    const quitarListener = NetInfo.addEventListener((estado) => {
      const disponible = estado.isConnected === true && estado.isInternetReachable !== false;
      setConexionDisponible(disponible);
      if (disponible) sincronizarYActualizar();
    });
    const intervaloEstado = setInterval(actualizarPendientes, 5000);
    const intervaloSincronizacion = setInterval(async () => {
      try {
        if (await getPendingMutationCount() === 0) return;
        const estado = await NetInfo.fetch();
        if (estado.isConnected === true && estado.isInternetReachable !== false) {
          await sincronizarYActualizar();
        }
      } catch (error) {
        console.error('No se pudo reintentar la sincronización offline:', error);
      }
    }, 30000);
    return () => {
      activa = false;
      clearInterval(intervaloEstado);
      clearInterval(intervaloSincronizacion);
      quitarListener();
    };
  }, [token]);

  const handleLoginSuccess = async (newToken, user) => {
    try {
      await saveSession(newToken, user);
    } catch (error) {
      console.error('No se pudo persistir la sesión para uso offline:', error);
      Alert.alert(
        'Modo offline no disponible',
        'La sesión inició, pero no pudo guardarse de forma segura en este dispositivo.'
      );
    }
    setToken(newToken);
    setUsuario(user);
  };

  // Función para cerrar sesión
  const handleLogout = async () => {
    try {
      await clearSession();
    } catch (error) {
      console.error('No se pudo borrar la sesión local:', error);
    }
    setToken(null);
    setUsuario(null);
    setCambiosPendientes(0);
  };

  if (restaurandoSesion) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas }}>
          <ActivityIndicator color={colors.green700} />
          <Text style={{ color: colors.muted, marginTop: 10 }}>Abriendo tus datos guardados...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!token) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
          <AuthScreen onLoginSuccess={handleLoginSuccess} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="dark" backgroundColor={colors.white} />
        <View style={{ flex: 1 }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.white }}>
        {conexionDisponible === false && (
          <Text style={{
            backgroundColor: colors.green950,
            color: colors.white,
            fontSize: 11,
            fontWeight: '600',
            paddingHorizontal: 12,
            paddingVertical: 7,
            textAlign: 'center'
          }}>
            Sin conexión · {cambiosPendientes
              ? `${cambiosPendientes} cambio(s) guardado(s) para sincronizar`
              : 'mostrando los últimos datos guardados'}
          </Text>
        )}
        {conexionDisponible === true && cambiosPendientes > 0 && (
          <Text style={{
            backgroundColor: colors.green100,
            color: colors.green800,
            fontSize: 11,
            fontWeight: '600',
            paddingHorizontal: 12,
            paddingVertical: 7,
            textAlign: 'center'
          }}>
            {cambiosPendientes} cambio(s) esperando sincronización
          </Text>
        )}
          <View style={{
            height: 58,
            backgroundColor: colors.white,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            paddingHorizontal: 17,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 30, height: 30, backgroundColor: colors.blue700, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
                <Text style={{ color: colors.white, fontWeight: '900', fontSize: 16 }}>N</Text>
              </View>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', letterSpacing: 1.2 }}>NIVIA</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Estado de sincronización"
                onPress={() => Alert.alert(
                  conexionDisponible === false ? 'Sin conexión' : 'Sincronización',
                  cambiosPendientes
                    ? `${cambiosPendientes} cambio(s) guardado(s) para sincronizar.`
                    : conexionDisponible === false
                      ? 'Tus datos guardados siguen disponibles en este dispositivo.'
                      : 'Tus datos están al día.'
                )}
                style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: colors.blue50, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 15 }}>🔔</Text>
                {(cambiosPendientes > 0 || conexionDisponible === false) && <View style={{ position: 'absolute', width: 7, height: 7, right: 5, top: 5, borderRadius: 4, backgroundColor: colors.emerald700 }} />}
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Abrir perfil y más secciones"
                onPress={() => setMenuVisible(true)}
                style={{ width: 35, height: 35, borderRadius: 18, backgroundColor: colors.emerald100, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.emerald700, fontSize: 13, fontWeight: '800' }}>{usuario?.name?.trim()?.[0]?.toUpperCase() || 'U'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
        <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarButton: ['Cuenta', 'Perfil'].includes(route.name) ? () => null : undefined,
          tabBarIcon: ({ color, size }) => {
            const icons = {
              Resumen: '⌂',
              Movimientos: '⇅',
              Análisis: '▥',
              Categorías: '◇',
              Cuentas: '▣',
              Presupuestos: '◷',
              Préstamos: '↗',
              Cuenta: '○',
              Perfil: '○'
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
          tabBarActiveTintColor: colors.blue700,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: {
            fontSize: 8,
            fontWeight: '700',
            lineHeight: 10,
            marginBottom: 4
          },
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            height: 65,
            paddingTop: 5,
            paddingBottom: 2,
            elevation: 0
          },
          tabBarItemStyle: {
            borderRadius: 10,
            flex: 1,
            minWidth: 0,
            marginHorizontal: 0,
            marginVertical: 4,
            paddingHorizontal: 0
          }
        })}
        >
          <Tab.Screen name="Resumen" options={{ tabBarLabel: 'Resumen' }}>
            {(props) => <DashboardScreen {...props} token={token} usuario={usuario} />}
          </Tab.Screen>

          <Tab.Screen name="Análisis" options={{ tabBarLabel: 'Análisis' }}>
            {(props) => <AnalysisScreen {...props} token={token} />}
          </Tab.Screen>
          <Tab.Screen name="Movimientos">
            {(props) => <RegistroScreen {...props} token={token} />}
          </Tab.Screen>
          <Tab.Screen name="Categorías">
            {(props) => <CategoriasScreen {...props} token={token} />}
          </Tab.Screen>
          <Tab.Screen name="Presupuestos">
            {(props) => <PresupuestosScreen {...props} token={token} />}
          </Tab.Screen>
          <Tab.Screen name="Préstamos">
            {(props) => <PrestamosScreen {...props} token={token} />}
          </Tab.Screen>
          <Tab.Screen name="Cuentas">
            {(props) => <CuentasScreen {...props} token={token} />}
          </Tab.Screen>
          <Tab.Screen name="Cuenta">
            {(props) => <ParejaScreen {...props} token={token} onLogout={handleLogout} />}
          </Tab.Screen>
          <Tab.Screen name="Perfil">
            {(props) => <PerfilScreen {...props} usuario={usuario} onLogout={handleLogout} />}
          </Tab.Screen>
        </Tab.Navigator>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Añadir movimiento"
          onPress={() => navigationRef.navigate('Movimientos', { abrirNuevo: true })}
          style={{
            position: 'absolute',
            bottom: 75,
            alignSelf: 'center',
            width: 54,
            height: 54,
            borderRadius: 20,
            backgroundColor: colors.blue700,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 6,
            shadowColor: colors.blue950,
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 }
          }}
        >
          <Text style={{ color: colors.white, fontSize: 29, lineHeight: 32, fontWeight: '400' }}>+</Text>
        </TouchableOpacity>
      </View>
        <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(23,32,51,0.28)', justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => setMenuVisible(false)} style={{ flex: 1 }} />
          <View style={{ backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 30 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 5 }}>Más de Nivia</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 14 }}>{usuario?.name || usuario?.email || 'Tu cuenta'}</Text>
            {[
              ['Categorías', '◇', 'Categorías'],
              ['Préstamos y deudas', '↗', 'Préstamos'],
              ['Cuenta compartida', '♡', 'Cuenta'],
              ['Mi perfil', '○', 'Perfil']
            ].map(([label, icon, destination]) => (
              <TouchableOpacity
                key={destination}
                onPress={() => {
                  setMenuVisible(false);
                  navigationRef.navigate(destination);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.line }}
              >
                <Text style={{ color: colors.blue700, fontSize: 18, width: 33 }}>{icon}</Text>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{label}</Text>
                <Text style={{ color: colors.muted, marginLeft: 'auto' }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        </Modal>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}