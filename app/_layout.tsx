/* ═══ ZAMER.PRO — приложение-оболочка ═══
   Внутри — онлайн-версия (smeta-xi.vercel.app): один код, один дизайн,
   любое обновление на сервере сразу появляется здесь. Данные (IndexedDB)
   живут в WKWebView и переживают перезапуск приложения. */
import '../global.css';
import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

const APP_URL = 'https://smeta-xi.vercel.app';
const ACCENT = '#4F46E5';

export default function RootLayout() {
  const webRef = useRef<WebView>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        {failed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Text style={{ fontSize: 40 }}>📡</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e2530', textAlign: 'center' }}>
              Нет соединения
            </Text>
            <Text style={{ fontSize: 13, color: '#8a8fa3', textAlign: 'center', lineHeight: 19 }}>
              ZAMER.PRO работает через интернет.{'\n'}Проверьте сеть и попробуйте ещё раз.
            </Text>
            <TouchableOpacity
              onPress={() => { setFailed(false); setLoading(true); webRef.current?.reload(); }}
              style={{ marginTop: 8, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Повторить</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <WebView
              ref={webRef}
              source={{ uri: APP_URL }}
              style={{ flex: 1, backgroundColor: '#f2f3fa' }}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setFailed(true); setLoading(false); }}
              /* данные калькулятора живут в localStorage/IndexedDB — не сбрасываем */
              domStorageEnabled
              javaScriptEnabled
              allowsBackForwardNavigationGestures
              pullToRefreshEnabled={false}
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              /* файлы: экспорт/импорт json и фото планировок */
              allowFileAccess
              originWhitelist={['*']}
            />
            {loading && (
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f3fa' }}>
                <ActivityIndicator size="large" color={ACCENT} />
                <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '700', color: ACCENT, letterSpacing: 1 }}>ZAMER.PRO</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
