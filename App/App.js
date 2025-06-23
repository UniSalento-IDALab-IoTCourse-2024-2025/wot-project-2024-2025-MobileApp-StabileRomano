import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Button, ScrollView, Alert } from 'react-native';
import Slider from '@react-native-community/slider';

export default function App() {
  const [connesso, setConnesso] = useState(false);
  const [filtroAttivo, setFiltroAttivo] = useState(false);
  const [dbValue, setDbValue] = useState(null);
  const [testoRilevato, setTestoRilevato] = useState('');
  const [soglia, setSoglia] = useState(85);
  const [erroreConnessione, setErroreConnessione] = useState('');
  const ws = useRef(null);

  const toggleConnessione = () => {
    if (!connesso) {
      setErroreConnessione('');
      ws.current = new WebSocket('ws://192.168.1.12:8765');

      ws.current.onopen = () => {
        console.log('Connessione WebSocket aperta');
        setConnesso(true);
        // Invia lo stato iniziale
        ws.current.send(JSON.stringify({
          soglia: soglia,
          filtroAttivo: filtroAttivo
        }));
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