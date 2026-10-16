import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView 
} from 'react-native';
import { registrarUsuario, iniciarSesion, loginConGoogleApi } from '../api';
import { colors } from '../theme';

export default function AuthScreen({ onLoginSuccess }) {
  const [modoRegistro, setModoRegistro] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // 1. Manejo de Registro / Login con Correo y Contraseña
  const handleSubmit = async () => {
    if (!email || !password || (modoRegistro && !name)) {
      Alert.alert("Campos incompletos", "Por favor completa todos los campos requeridos.");
      return;
    }

    if (modoRegistro) {
      const res = await registrarUsuario({ name, email, password });
      if (res.exito) {
        Alert.alert("¡Bienvenido a Nivia!", "Registro completado con éxito.");
        onLoginSuccess(res.token, res.usuario);
      } else {
        Alert.alert("Error de Registro", res.mensaje);
      }
    } else {
      const res = await iniciarSesion({ email, password });
      if (res.exito) {
        Alert.alert("¡Bienvenido!", `Sesión iniciada como ${res.usuario.email}`);
        onLoginSuccess(res.token, res.usuario);
      } else {
        Alert.alert("Error al ingresar", res.mensaje);
      }
    }
  };

  // 2. Manejo de Autenticación vía Google OAuth 2.0
  const handleGoogleLogin = async () => {
    try {
      // NOTA: Para el entorno local/Expo Go enviamos la credencial mock
      // que el backend procesa o puedes sustituir por tu SDK de Google en build nativo.
      const idTokenDeGoogle = "token_obtenido_de_google_sdk"; 
      
      const res = await loginConGoogleApi(idTokenDeGoogle);
      if (res.exito) {
        Alert.alert("¡Bienvenido a Nivia!", `Iniciaste sesión con Google como ${res.usuario.email}`);
        onLoginSuccess(res.token, res.usuario);
      } else {
        Alert.alert("Error de autenticación", res.mensaje);
      }
    } catch (err) {
      Alert.alert("Error", "No se pudo completar el inicio de sesión con Google.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.appTitle}>Nivia</Text>
          <Text style={styles.appSub}>Finanzas Personales y de Pareja</Text>

          <Text style={styles.title}>
            {modoRegistro ? 'Crear Cuenta en Nivia' : 'Iniciar Sesión'}
          </Text>

          {/* Botón Google OAuth 2.0 */}
          <TouchableOpacity style={styles.btnGoogle} onPress={handleGoogleLogin}>
            <Text style={styles.btnGoogleText}>🌐 Continuar con Google</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o con tu correo</Text>
            <View style={styles.dividerLine} />
          </View>

          {modoRegistro && (
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor="#a1aaa4"
              value={name}
              onChangeText={setName}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor="#a1aaa4"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#a1aaa4"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>
              {modoRegistro ? 'Registrarse' : 'Ingresar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setModoRegistro(!modoRegistro)} 
            style={styles.switchContainer}
          >
            <Text style={styles.switchText}>
              {modoRegistro 
                ? '¿Ya tienes cuenta? Inicia Sesión' 
                : '¿No tienes cuenta? Regístrate'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 17, padding: 24, elevation: 0 },
  appTitle: { fontSize: 32, fontWeight: '700', color: colors.green950, textAlign: 'center', letterSpacing: -1 },
  appSub: { fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 22 },
  title: { fontSize: 17, fontWeight: '700', color: colors.green950, marginBottom: 15, textAlign: 'center' },
  btnGoogle: { 
    backgroundColor: '#ffffff', 
    borderWidth: 1, 
    borderColor: colors.line, 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginBottom: 15,
    elevation: 1 
  },
  btnGoogleText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { marginHorizontal: 10, color: colors.muted, fontSize: 11 },
  input: { backgroundColor: '#fbfcfb', borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 13, marginBottom: 11, fontSize: 14, color: colors.ink },
  button: { backgroundColor: colors.green800, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  switchContainer: { marginTop: 18, alignItems: 'center' },
  switchText: { color: colors.green800, fontSize: 12, fontWeight: '700' }
});