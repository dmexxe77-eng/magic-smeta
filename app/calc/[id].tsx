import { useLocalSearchParams } from 'expo-router';
import CalcScreen from '../../src/components/screens/CalcScreen';

export default function CalcRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CalcScreen orderId={id} />;
}
