import { useState, useEffect, useCallback, useRef } from 'react';
import { Magnetometer, type MagnetometerMeasurement } from 'expo-sensors';
import { Platform } from 'react-native';
import { snapAngle } from '../utils/geometry';

export type CompassPermState = 'idle' | 'requesting' | 'granted' | 'denied';

export interface UseCompassResult {
  heading: number | null;          // raw heading 0-360
  snappedHeading: number;          // snapped to cardinal/intercardinal
  permState: CompassPermState;
  requestPermission: () => Promise<void>;
}

export function useCompass(): UseCompassResult {
  const [heading, setHeading] = useState<number | null>(null);
  const [permState, setPermState] = useState<CompassPermState>('idle');
  const subRef = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);

  const startListening = useCallback(() => {
    Magnetometer.setUpdateInterval(100);
    subRef.current = Magnetometer.addListener(
      (data: MagnetometerMeasurement) => {
        // Calculate heading from magnetometer X/Y
        let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
        // Normalize to 0-360
        angle = (angle + 360) % 360;
        // On iOS compass points: 0 = North, 90 = East
        // Magnetometer atan2 gives: 0 = East, so adjust
        angle = (90 - angle + 360) % 360;
        setHeading(Math.round(angle));
      }
    );
  }, []);

  const requestPermission = useCallback(async () => {
    setPermState('requesting');
    try {
      const { granted } = await Magnetometer.requestPermissionsAsync();
      if (granted) {
        setPermState('granted');
        startListening();
      } else {
        setPermState('denied');
      }
    } catch (e) {
      setPermState('denied');
    }
  }, [startListening]);

  useEffect(() => {
    return () => {
      subRef.current?.remove();
    };
  }, []);

  const snappedHeading = snapAngle(heading ?? 0);

  return { heading, snappedHeading, permState, requestPermission };
}
