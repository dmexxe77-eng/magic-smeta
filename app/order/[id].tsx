import { useLocalSearchParams } from 'expo-router';
import OrderScreen from '../../src/components/screens/OrderScreen';

export default function OrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderScreen orderId={id} />;
}
