import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, FlatList, Image, Alert, Dimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import PdfRendererView from 'react-native-pdf-renderer';

interface PdfPickerProps {
  onImage: (uri: string, w: number, h: number, sourcePdfUri: string) => void;
  onBack: () => void;
  insets: { top: number };
  initialPdfUri?: string | null;
}

const SCREEN = Dimensions.get('window');
const COLS = SCREEN.width >= 700 ? 3 : 2;
const GAP = 12;
const PAD = 16;
const TILE_W = (SCREEN.width - PAD * 2 - GAP * (COLS - 1)) / COLS;
const TILE_H = TILE_W * 1.3;

// ─── Lazy page preview tile ──────────────────────────────────────────

function PagePreview({ pdfUri, pageIdx, onPress }: {
  pdfUri: string; pageIdx: number; onPress: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await PdfThumbnail.generate(pdfUri, pageIdx, 30);
        if (!cancelled) setThumb(r.uri);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUri, pageIdx]);

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: TILE_W, height: TILE_H,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1, borderColor: '#e8e8e4',
        overflow: 'hidden',
        marginBottom: GAP,
      }}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ flex: 1 }} resizeMode="contain" />
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>—</Text>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#4F46E5" />
        </View>
      )}
      <View style={{
        position: 'absolute', bottom: 4, left: 4,
        backgroundColor: 'rgba(30,32,48,0.85)',
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
      }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>стр. {pageIdx + 1}</Text>
      </View>
    </Pressable>
  );
}

// ─── Main picker ─────────────────────────────────────────────────────

export default function PdfPicker({ onImage, onBack, insets, initialPdfUri }: PdfPickerProps) {
  const [pdfUri, setPdfUri] = useState<string | null>(initialPdfUri ?? null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [picking, setPicking] = useState(!initialPdfUri);
  const [renderingHi, setRenderingHi] = useState(false);

  const pickPdf = useCallback(async () => {
    try {
      setPicking(true);
      setTotalPages(null);
      setPdfUri(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) {
        onBack();
        return;
      }
      setPdfUri(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось открыть PDF');
      onBack();
    } finally {
      setPicking(false);
    }
  }, [onBack]);

  useEffect(() => {
    if (!initialPdfUri) pickPdf();
  }, [initialPdfUri, pickPdf]);

  const selectPage = async (idx: number) => {
    if (!pdfUri) return;
    try {
      setRenderingHi(true);
      const hi = await PdfThumbnail.generate(pdfUri, idx, 100);
      onImage(hi.uri, hi.width, hi.height, pdfUri);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось отрендерить страницу');
      setRenderingHi(false);
    }
  };

  const renderPage = ({ item }: { item: number }) => (
    <PagePreview pdfUri={pdfUri!} pageIdx={item} onPress={() => selectPage(item)} />
  );

  return (
    <View className="flex-1 bg-bg">
      <View className="bg-white border-b border-border px-4 pb-3" style={{ paddingTop: insets.top + 4 }}>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={onBack} className="w-9 h-9 rounded-[9px] bg-bg items-center justify-center">
            <Text className="text-navy text-xl font-bold">‹</Text>
          </Pressable>
          <Text className="text-[14px] font-bold text-navy flex-1">
            {totalPages ? `Выберите лист (${totalPages})` : 'PDF проект'}
          </Text>
          {pdfUri && totalPages && (
            <Pressable onPress={pickPdf} className="px-3 py-1.5 rounded-lg bg-bg">
              <Text className="text-xs text-accent font-semibold">Другой PDF</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Hidden probe to get totalPages without rendering all thumbnails */}
      {pdfUri && totalPages == null && (
        <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0, top: -10 }}>
          <PdfRendererView
            source={pdfUri}
            singlePage
            onPageChange={(_, total) => setTotalPages(total)}
            onError={() => {
              Alert.alert('Ошибка', 'PDF файл повреждён или защищён паролем');
              onBack();
            }}
          />
        </View>
      )}

      {renderingHi ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-muted text-sm">Подготовка страницы в макс. качестве…</Text>
        </View>
      ) : picking || !pdfUri || totalPages == null ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-muted text-sm">
            {picking ? 'Выбор файла…' : 'Чтение PDF…'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={Array.from({ length: totalPages }, (_, i) => i)}
          keyExtractor={(i) => `pdf-page-${i}`}
          renderItem={renderPage}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ padding: PAD }}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
}
