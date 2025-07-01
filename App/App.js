import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Button, ScrollView, Alert, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [connesso, setConnesso] = useState(false);
  const [filtroAttivo, setFiltroAttivo] = useState(false);
  const [dbValue, setDbValue] = useState(null);
  const [testoRilevato, setTestoRilevato] = useState('');
  const [soglia, setSoglia] = useState(85);
  const [erroreConnessione, setErroreConnessione] = useState('');
  const [nomeUtente, setNomeUtente] = useState('');
  const [nomeSalvato, setNomeSalvato] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    const caricaNome = async () => {
      try {
        const nome = await AsyncStorage.getItem('nomeUtente');
        if (nome) {
          setNomeUtente(nome);
          setNomeSalvato(true);
        }
      } catch (e) {
        console.error("Errore nel recupero del nome utente:", e);
      }
    };
    caricaNome();
  }, []);

  const salvaNome = async () => {
    try {
      await AsyncStorage.setItem('nomeUtente', nomeUtente);
      setNomeSalvato(true);
    } catch (e) {
      console.error("Errore nel salvataggio del nome:", e);
    }
  };

  const mostraAvvisoConnessione = () => {
    Alert.alert(
      "Problema di connessione",
      "Impossibile connettersi al server. Verifica che:\n\n1. Il server Python sia avviato\n2. Le cuffie siano accese\n3. Entrambi i dispositivi siano sulla stessa rete Wi-Fi\n4. L'indirizzo IP sia corretto",
      [{ text: "OK" }]
    );
  };

  const mostraNotificaSoglia = (rumore, soglia) => {
    Alert.alert(
      "Allarme Rumore Elevato",
      `Livello rumore rilevato: ${rumore} dB(A)\nSoglia impostata: ${soglia} dB(A)\n\nIl filtro acustico è stato attivato automaticamente.`,
      [{ text: "OK" }],
      { cancelable: false }
    );
  };

  const toggleConnessione = () => {
    if (!connesso) {
      if (!nomeUtente.trim()) {
        Alert.alert("Nome richiesto", "Inserisci il tuo nome prima di connetterti.");
        return;
      }

      setErroreConnessione('');
      ws.current = new WebSocket('ws://192.168.1.19:8765');

      ws.current.onopen = () => {
        console.log('Connessione WebSocket aperta');
        setConnesso(true);
        ws.current.send(JSON.stringify({
          soglia: soglia,
          filtroAttivo: filtroAttivo,
          nomeUtente: nomeUtente
        }));
        salvaNome();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tipo === 'notifica') {
            mostraNotificaSoglia(data.rumore, data.soglia);
            if (!filtroAttivo) {
              setFiltroAttivo(true);
              ws.current.send(JSON.stringify({
                filtroAttivo: true,
                azione: 'automatica'
              }));
            }
          } else {
            if (data.db !== undefined) setDbValue(data.db);
            if (data.testo !== undefined) setTestoRilevato(data.testo);
            if (data.filtroAttivo !== undefined) setFiltroAttivo(data.filtroAttivo);
          }
        } catch (error) {
          console.error('Errore parsing messaggio:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.log('Errore WebSocket:', error.message);
        setErroreConnessione(error.message || 'Errore sconosciuto');
        mostraAvvisoConnessione();
      };

      ws.current.onclose = () => {
        console.log('Connessione WebSocket chiusa');
        setConnesso(false);
        setFiltroAttivo(false);
      };
    } else {
      ws.current.close();
    }
  };

  const toggleFiltro = () => {
    const nuovoStato = !filtroAttivo;
    setFiltroAttivo(nuovoStato);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        filtroAttivo: nuovoStato,
        azione: 'manuale'
      }));
    }
  };

  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (connesso && ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ soglia }));
    }
  }, [soglia]);

  return (
    <View style={styles.container}>
      {!connesso && (
        <View style={styles.nomeInputContainer}>
          <Text style={styles.label}>Inserisci il tuo nome:</Text>
          <TextInput
            style={styles.input}
            placeholder="Es. Mario Rossi"
            value={nomeUtente}
            onChangeText={setNomeUtente}
          />
        </View>
      )}

      <Button
        title={connesso ? 'Disconnetti' : 'Connetti'}
        onPress={toggleConnessione}
        color={connesso ? "#FF3B30" : "#34C759"}
      />

      <Text style={styles.status}>
        Stato: <Text style={{ color: connesso ? 'green' : 'red' }}>
          {connesso ? 'Connesso' : 'Disconnesso'}
        </Text>
      </Text>

      {connesso && nomeUtente ? (
        <Text style={styles.nomeUtente}>Utente: {nomeUtente}</Text>
      ) : null}

      {erroreConnessione ? (
        <Text style={styles.errore}>Errore: {erroreConnessione}</Text>
      ) : null}

      {connesso && (
        <>
          <Button
            title={filtroAttivo ? '🔇 Disattiva filtro' : '🔈 Attiva filtro'}
            onPress={toggleFiltro}
            color={filtroAttivo ? "#FF9500" : "#007AFF"}
          />

          <View style={styles.sogliaContainer}>
            <Text style={styles.label}>Soglia allarme: {soglia.toFixed(1)} dB(A)</Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={30}
              maximumValue={85}
              step={1}
              value={soglia}
              onValueChange={(val) => val <= 85 && setSoglia(val)}
              minimumTrackTintColor="#1EB1FC"
              maximumTrackTintColor="#d3d3d3"
              thumbTintColor="#1EB1FC"
            />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Livello rumore attuale:</Text>
            <Text style={[styles.value, { color: dbValue >= soglia ? 'red' : 'green' }]}>
              {dbValue !== null ? dbValue.toFixed(1) : '--'} dB(A)
            </Text>
            {dbValue !== null && dbValue >= soglia && (
              <Text style={styles.warning}>⚠️ Soglia superata</Text>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Log eventi:</Text>
            <ScrollView style={styles.scrollView}>
              <Text style={styles.value}>{testoRilevato || 'Nessun evento rilevato'}</Text>
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 40,
  },
  nomeInputContainer: {
    marginBottom: 15,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    marginTop: 5,
  },
  status: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 10,
    fontWeight: '500',
  },
  nomeUtente: {
    fontSize: 16,
    textAlign: 'center',
    color: '#444',
    marginBottom: 10,
    fontWeight: '600',
  },
  errore: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 5,
    color: 'red',
    fontWeight: '500',
  },
  sogliaContainer: {
    marginTop: 25,
    marginBottom: 15,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  infoBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 16,
    color: '#333',
  },
  value: {
    fontSize: 16,
    color: '#666',
  },
  warning: {
    color: 'red',
    fontWeight: '600',
    marginTop: 5,
  },
  scrollView: {
    maxHeight: 100,
  },
});
