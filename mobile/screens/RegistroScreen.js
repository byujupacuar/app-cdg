import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerCategorias, guardarMovimientoReal } from '../api';
import { colors } from '../theme';

export default function RegistroScreen({ token }) {
  const [tipo, setTipo] = useState('GASTO'); // 'GASTO' | 'INGRESO'
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  
  const [categorias, setCategorias] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let activa = true;
      setLoadingCats(true);

      const cargarCategorias = async () => {
        const res = await obtenerCategorias(token);
        if (!activa) return;

        if (res.exito) {
          setCategorias(res.categorias);
          const categoriasTipo = res.categorias.filter(categoria => categoria.type === tipo);
          setCategoriaSeleccionada(actual =>
            categoriasTipo.some(categoria => categoria.name === actual)
              ? actual
              : categoriasTipo[0]?.name || null
          );
        } else {
          Alert.alert("Error", res.mensaje || "No se pudieron cargar las categorías desde la base de datos.");
        }

        setLoadingCats(false);
      };

      cargarCategorias();
      return () => {
        activa = false;
      };
    }, [token, tipo])
  );

  const handleGuardar = async () => {
    if (!monto || parseFloat(monto) <= 0) {
      Alert.alert("Monto inválido", "Por favor ingresa un monto mayor a cero.");
      return;
    }

    if (!categoriaSeleccionada) {
      Alert.alert("Selecciona categoría", "Debes elegir o crear una categoría primero.");
      return;
    }

    setGuardando(true);

    const res = await guardarMovimientoReal({
      amount: parseFloat(monto),
      type: tipo,
      categoryName: categoriaSeleccionada,
      description: descripcion || 'Sin detalle'
    }, token);

    setGuardando(false);

    if (res.exito) {
      Alert.alert("¡Éxito! 🚀", `${tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} guardado en PostgreSQL.`);
      setMonto('');
      setDescripcion('');
    } else {
      Alert.alert("Error al guardar", res.mensaje);
    }
  };

  // Filtrar categorías según el tipo seleccionado (GASTO o INGRESO)
  const categoriasFiltradas = categorias.filter(c => c.type === tipo);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.titulo}>Registro Rápido</Text>

      {/* Selector Gasto / Ingreso */}
      <View style={styles.tipoRow}>
        <TouchableOpacity 
          style={[styles.btnTipo, tipo === 'GASTO' && styles.btnGastoActivo]} 
          onPress={() => setTipo('GASTO')}
        >
          <Text style={[styles.txtTipo, tipo === 'GASTO' && styles.txtActivo]}>Gasto</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btnTipo, tipo === 'INGRESO' && styles.btnIngresoActivo]} 
          onPress={() => setTipo('INGRESO')}
        >
          <Text style={[styles.txtTipo, tipo === 'INGRESO' && styles.txtActivo]}>Ingreso</Text>
        </TouchableOpacity>
      </View>

      {/* Input de Monto */}
      <Text style={styles.label}>Monto ($):</Text>
      <TextInput 
        style={styles.inputMonto} 
        placeholder="0.00" 
        keyboardType="numeric" 
        value={monto} 
        onChangeText={setMonto} 
      />

      {/* Selector de Categorías Dinámicas */}
      <Text style={styles.label}>Categoría</Text>
      {loadingCats ? (
        <ActivityIndicator size="small" color={colors.green700} style={{ marginVertical: 15 }} />
      ) : categoriasFiltradas.length === 0 ? (
        <View style={styles.vacioBox}>
          <Text style={styles.vacioTxt}>
            No hay categorías de {tipo.toLowerCase()} creadas. Ve a la pestaña "Categorías" para agregar una.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          style={styles.categoriasScroll}
          contentContainerStyle={styles.categoriasRow}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {categoriasFiltradas.map((cat) => {
            const esSeleccionada = categoriaSeleccionada === cat.name;
            return (
              <TouchableOpacity 
                key={cat.id} 
                style={[styles.catCard, esSeleccionada && styles.catCardSeleccionada]} 
                onPress={() => setCategoriaSeleccionada(cat.name)}
              >
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={[styles.catName, esSeleccionada && styles.txtBlanco]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Detalle / Descripción */}
      <Text style={styles.label}>Detalle <Text style={styles.labelOptional}>(opcional)</Text></Text>
      <TextInput 
        style={styles.inputDetalle} 
        placeholder="Ej. Almuerzo trabajo, Pago sueldo..." 
        value={descripcion} 
        onChangeText={setDescripcion} 
      />

      {/* Botón Guardar */}
      <TouchableOpacity 
        style={[styles.btnGuardar, guardando && { backgroundColor: '#bdc3c7' }]} 
        onPress={handleGuardar}
        disabled={guardando}
      >
        {guardando ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.btnTexto}>Guardar Movimiento</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1 },
  content: { padding: 18, paddingTop: 22, paddingBottom: 32 },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.green950, letterSpacing: -0.4, marginBottom: 18 },
  tipoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, backgroundColor: '#edf1ed', borderRadius: 11, padding: 4 },
  btnTipo: { flex: 1, padding: 11, borderRadius: 8, backgroundColor: 'transparent', alignItems: 'center', marginHorizontal: 2 },
  btnGastoActivo: { backgroundColor: colors.white, elevation: 1 },
  btnIngresoActivo: { backgroundColor: colors.white, elevation: 1 },
  txtTipo: { fontSize: 13, fontWeight: '700', color: colors.muted },
  txtActivo: { color: colors.green800 },
  label: { fontSize: 12, fontWeight: '700', color: '#5f6d64', marginBottom: 7, marginTop: 10 },
  labelOptional: { color: '#9aa69f', fontWeight: '400' },
  inputMonto: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 23, fontWeight: '700', color: colors.green950 },
  categoriasScroll: { flexGrow: 0, marginVertical: 3 },
  categoriasRow: { paddingVertical: 4 },
  catCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center', marginRight: 8 },
  catCardSeleccionada: { backgroundColor: colors.green100, borderColor: '#83ac91' },
  catIcon: { fontSize: 17, marginBottom: 2 },
  catName: { fontSize: 11, fontWeight: '700', color: colors.ink },
  vacioBox: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, padding: 14, borderRadius: 10, marginVertical: 8, alignItems: 'center' },
  vacioTxt: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  inputDetalle: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 14, color: colors.ink, marginBottom: 17 },
  btnGuardar: { backgroundColor: colors.green800, padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  btnTexto: { color: colors.white, fontSize: 14, fontWeight: '700' }
});