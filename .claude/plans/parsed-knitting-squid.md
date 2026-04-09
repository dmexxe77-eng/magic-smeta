# Plan: Обводка плана (Trace Builder)

## Context
Кнопка "Обводка" в калькуляторе сейчас показывает заглушку. Нужно реализовать полноценную обводку: загрузка PDF/фото плана, выбор страницы PDF, размещение точек поверх изображения для создания контура комнаты, калибровка масштаба, и отправка результата в калькулятор.

## Flow пользователя
1. Нажимает "Обводка" в CalcScreen
2. Выбирает файл (фото из галереи или PDF)
3. Если PDF — выбирает страницу (сетка превью)
4. Видит изображение плана на весь экран с pinch-to-zoom
5. Тапает — ставит точку (вершину). Долгое нажатие — лупа для точного позиционирования
6. Точки соединяются линиями, формируя полигон
7. Нажимает "Завершить фигуру" — полигон замыкается
8. Вводит длину одной стороны в см (калибровка масштаба)
9. Вводит название помещения
10. Программа рассчитывает площадь/периметр, создаёт Room и отправляет в калькулятор
11. На плане отображается закрашенный полигон с размерами сторон и названием в центре
12. Может обводить следующее помещение или нажать "Готово" → возврат в калькулятор

## Новые зависимости (npm install)
```
expo-image-picker    — выбор фото из галереи / камеры
expo-document-picker — выбор PDF файлов
expo-file-system     — чтение файлов, конвертация в base64
```
PDF рендеринг: для MVP можно использовать `react-native-pdf-light` или конвертировать страницы PDF в изображения на стороне клиента. Альтернатива — пользователь делает скриншот страницы PDF и загружает как фото.

## Файлы для создания/изменения

### Новые файлы:
1. **`src/components/builders/TraceBuilder.tsx`** — основной компонент обводки
   - Props: `{ orderId, planImage, existingRooms, existingCount, onFinish, onAddRoom, onBack }`
   - Состояния: `idle` → `placing` → `calibrating` → `naming` → `done`
   - Pinch-to-zoom через `react-native-gesture-handler` + `react-native-reanimated`
   - SVG overlay поверх изображения для отрисовки точек, линий, полигонов
   - Лупа при долгом нажатии (круглый View с увеличенным фрагментом)

2. **`src/components/builders/PlanPicker.tsx`** — выбор файла и страницы PDF
   - Props: `{ onImageSelected, onBack }`
   - Кнопки: "Из галереи", "Камера", "PDF файл"
   - Если PDF — сетка страниц для выбора (как в веб-версии)

### Изменяемые файлы:
3. **`src/components/screens/CalcScreen.tsx`** (строка ~378)
   - Кнопка "Обводка" → запускает PlanPicker → затем TraceBuilder
   - Добавить состояния `showPlanPicker` и `showTraceBuilder`

4. **`package.json`** — добавить зависимости

5. **`app.json`** — добавить плагины expo-image-picker, expo-document-picker

## Переиспользуемые утилиты
- `calcPoly(verts)` из `src/utils/geometry.ts` — площадь и периметр
- `generateId()` из `src/utils/storage.ts` — ID для комнат
- `savePlanImage(orderId, base64)` / `loadPlanImage(orderId)` — уже готовы
- `fmt(n)` из `src/utils/geometry.ts` — форматирование чисел
- Паттерн создания Room из `CompassBuilder.tsx` (строки 213-228)

## Архитектура TraceBuilder

### Состояние компонента:
```typescript
// Точки в координатах изображения (пиксели)
const [points, setPoints] = useState<{x: number, y: number}[]>([]);
// Масштаб: пиксели → метры
const [scale, setScale] = useState<number | null>(null);
// Калибровочная сторона (индекс)
const [calibSide, setCalibSide] = useState(0);
// Завершённые комнаты на этом плане
const [rooms, setRooms] = useState<Room[]>([]);
// Этап: placing → closed → calibrating → naming
const [phase, setPhase] = useState<'placing' | 'closed' | 'calibrating' | 'naming'>('placing');
```

### Алгоритм калибровки:
1. Пользователь обвёл комнату (точки в пикселях изображения)
2. Выбирает одну сторону и вводит её реальную длину в см
3. `pixelLength = distance(p1, p2)` — длина стороны в пикселях
4. `scale = realLength_cm / pixelLength` — см на пиксель
5. Все точки конвертируются: `vertex_m = {x: px.x * scale / 100, y: px.y * scale / 100}`
6. `calcPoly(vertices_m)` → площадь м², периметр м

### Zoom/Pan:
- `react-native-gesture-handler` PinchGestureHandler + PanGestureHandler
- `react-native-reanimated` для плавности анимации
- Shared values: `scale`, `translateX`, `translateY`, `focalX`, `focalY`

### SVG Overlay:
- Линии между точками
- Кружки на вершинах (перетаскиваемые)
- Закрашенный полигон для завершённых комнат (полупрозрачный accent)
- Подписи длин сторон на середине каждого ребра
- Название помещения в центре полигона

### Лупа (Long Press):
- При долгом нажатии показывать круглый View 120x120
- Внутри — увеличенный в 3x фрагмент изображения
- Позиция — над пальцем
- Крестик в центре лупы для точного позиционирования

## Этапы реализации (порядок)

### Этап 1: Зависимости и PlanPicker
- `npm install expo-image-picker expo-document-picker expo-file-system`
- Создать PlanPicker.tsx — выбор изображения
- Для MVP: только фото из галереи + камера (PDF позже)

### Этап 2: TraceBuilder — базовый
- Отображение изображения с zoom/pan
- Тап → точка
- Линии между точками (SVG overlay)
- Кнопка "Замкнуть фигуру"

### Этап 3: Калибровка и создание Room
- Выбор стороны для калибровки
- Ввод длины в см
- Конвертация пиксели → метры
- Ввод названия помещения
- Создание Room объекта

### Этап 4: Множественные комнаты
- Отображение завершённых комнат на плане
- Подсветка полигонов, длины сторон, названия
- Кнопка "Ещё комнату" / "Готово"

### Этап 5 (позже): PDF поддержка
- Загрузка PDF
- Сетка страниц для выбора
- Конвертация страницы PDF в изображение

## Интеграция с CalcScreen

В `CalcScreen.tsx` добавить:
```typescript
const [showPlanPicker, setShowPlanPicker] = useState(false);
const [showTrace, setShowTrace] = useState(false);
const [planImageBase64, setPlanImageBase64] = useState<string | null>(null);

// В кнопке "Обводка":
onPress={() => setShowPlanPicker(true)}

// PlanPicker → выбирает изображение → setPlanImageBase64 + setShowTrace(true)
// TraceBuilder → onAddRoom → добавляет комнату в rooms
// TraceBuilder → onFinish → возврат в калькулятор, savePlanImage()
```

## Verification
1. Нажать "Обводка" → открывается выбор файла
2. Выбрать фото из галереи → отображается на экране
3. Pinch-to-zoom работает
4. Тап ставит точку, видны линии между точками
5. "Замкнуть" → полигон закрывается
6. Ввести длину стороны → масштаб калибруется
7. Ввести название → Room создаётся с правильной площадью/периметром
8. Room появляется в списке комнат калькулятора
9. На плане отображается закрашенный полигон
10. Можно добавить ещё комнату
11. "Готово" → возврат в калькулятор
