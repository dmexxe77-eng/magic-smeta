# Magic Studio — React Native App

Мобильное приложение для мастеров натяжных потолков.

## Стек

- **Expo** (managed workflow)
- **TypeScript** (строгая типизация)
- **NativeWind** (Tailwind CSS для React Native)
- **Expo Router** (файловая маршрутизация)
- **expo-sensors** (компас через Magnetometer)
- **AsyncStorage** (персистентное хранилище)
- **react-native-svg** (SVG чертежи помещений)

## Структура

```
app/                     # Expo Router маршруты
  (tabs)/                # Главные вкладки
    index.tsx            # Проекты
    clients.tsx          # Клиенты
    finance.tsx          # Финансы (PRO)
    settings.tsx         # Настройки
  order/[id].tsx         # Страница проекта
  calc/[id].tsx          # Калькулятор смет

src/
  types/index.ts         # TypeScript типы
  store/AppContext.tsx   # Глобальный стейт
  utils/
    storage.ts           # AsyncStorage
    geometry.ts          # calcPoly, snapAngle
  hooks/
    useCompass.ts        # Magnetometer компас
  components/
    ui/index.tsx         # Переиспользуемые компоненты
    screens/             # Экраны
    builders/            # Построители помещений
```

## Запуск

```bash
npm install
npx expo start
```

Открыть в Expo Go на телефоне или в симуляторе.

## Ключевые отличия от web-версии

| Web | React Native |
|-----|-------------|
| `div/span` | `View/Text` |
| CSS | NativeWind Tailwind классы |
| `IndexedDB/localStorage` | `AsyncStorage` |
| `DeviceOrientationEvent` | `expo-sensors Magnetometer` |
| `react-router` | `expo-router` |
| HTML `<svg>` | `react-native-svg` |
