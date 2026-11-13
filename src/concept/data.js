export const STATUSES = [
  { id: 'new', label: 'Новый', color: '#6c7a89' },
  { id: 'estimate', label: 'Смета готова', color: '#b7832e' },
  { id: 'contract', label: 'Договор', color: '#587947' },
  { id: 'install', label: 'Монтаж', color: '#735e9a' },
  { id: 'done', label: 'Завершён', color: '#4f7c64' },
];

// Вымышленные объекты и контактные данные для локального дизайн-концепта.
export const INITIAL_PROJECTS = [
  {
    id: 'ZX-1042',
    name: 'Квартира на Ленина',
    address: 'Хабаровск, ул. Ленина, 42, кв. 18',
    client: 'Анна Соколова',
    phone: '+7 (900) 000-10-42',
    status: 'estimate',
    date: '2026-10-31',
    time: '10:30',
    paid: 0,
    rooms: [
      { id: '1042-1', name: 'Гостиная', width: 5.2, length: 4.6, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 8, rate: 650, profileRate: 350, lightRate: 550 },
      { id: '1042-2', name: 'Спальня', width: 4.5, length: 4.2, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 6, rate: 650, profileRate: 350, lightRate: 550 },
    ],
  },
  {
    id: 'ZX-1041',
    name: 'Дом у Амура',
    address: 'Хабаровск, ул. Тихоокеанская, 156',
    client: 'Михаил Орлов',
    phone: '+7 (900) 000-10-41',
    status: 'contract',
    date: '2026-10-31',
    time: '14:00',
    paid: 45000,
    rooms: [
      { id: '1041-1', name: 'Гостиная', width: 6, length: 5, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 12, rate: 650, profileRate: 350, lightRate: 550 },
      { id: '1041-2', name: 'Кухня', width: 4.8, length: 4, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 8, rate: 650, profileRate: 350, lightRate: 550 },
      { id: '1041-3', name: 'Спальня', width: 5, length: 4.4, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 6, rate: 650, profileRate: 350, lightRate: 550 },
    ],
  },
  {
    id: 'ZX-1040',
    name: 'Студия на Муравьёва',
    address: 'Хабаровск, ул. Муравьёва-Амурского, 31, кв. 24',
    client: 'Полина Морозова',
    phone: '+7 (900) 000-10-40',
    status: 'new',
    date: '2026-11-01',
    time: '11:00',
    paid: 0,
    rooms: [
      { id: '1040-1', name: 'Студия', width: 5.6, length: 5, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 10, rate: 650, profileRate: 350, lightRate: 550 },
    ],
  },
  {
    id: 'ZX-1039',
    name: 'Квартира на Шеронова',
    address: 'Хабаровск, ул. Шеронова, 68, кв. 7',
    client: 'Денис Волков',
    phone: '+7 (900) 000-10-39',
    status: 'install',
    date: '2026-11-01',
    time: '09:00',
    paid: 32000,
    rooms: [
      { id: '1039-1', name: 'Гостиная', width: 5.1, length: 4.8, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 8, rate: 650, profileRate: 350, lightRate: 550 },
      { id: '1039-2', name: 'Спальня', width: 4.5, length: 4, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 6, rate: 650, profileRate: 350, lightRate: 550 },
    ],
  },
  {
    id: 'ZX-1038',
    name: 'Квартира на Карла Маркса',
    address: 'Хабаровск, ул. Карла Маркса, 99, кв. 36',
    client: 'Елена Лебедева',
    phone: '+7 (900) 000-10-38',
    status: 'done',
    date: '2026-10-30',
    time: '15:30',
    paid: 23700,
    rooms: [
      { id: '1038-1', name: 'Гостиная', width: 5, length: 4, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 8, rate: 650, profileRate: 350, lightRate: 550 },
    ],
  },
  {
    id: 'ZX-1037',
    name: 'Квартира на Гамарника',
    address: 'Хабаровск, ул. Гамарника, 21, кв. 52',
    client: 'Артём Белов',
    phone: '+7 (900) 000-10-37',
    status: 'estimate',
    date: '2026-11-02',
    time: '16:00',
    paid: 0,
    rooms: [
      { id: '1037-1', name: 'Гостиная', width: 5.2, length: 4.5, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 8, rate: 650, profileRate: 350, lightRate: 550 },
      { id: '1037-2', name: 'Спальня', width: 4.6, length: 4.2, canvas: 'MSD Premium', profile: 'Теневой EuroKRAAB', lights: 6, rate: 650, profileRate: 350, lightRate: 550 },
    ],
  },
];

export function roomTotal(room) {
  return room.width * room.length * room.rate
    + (room.width + room.length) * 2 * room.profileRate
    + room.lights * room.lightRate;
}

export function projectTotal(project) {
  return project.rooms.reduce((total, room) => total + roomTotal(room), 0);
}

export function projectArea(project) {
  return project.rooms.reduce((total, room) => total + room.width * room.length, 0);
}

const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export function formatNumber(number) {
  return numberFormatter.format(number);
}

export function money(number) {
  return `${formatNumber(number)} ₽`;
}
