/* Версии ЗАМЕРX в стартовом меню. Онлайн-версия живёт отдельным проектом на Vercel
   (репозиторий dmexxe77-eng/magic-online); пока адрес не вписан, карточка неактивна. */
export const ONLINE_URL = 'https://magic-online-orpin.vercel.app';

export const VERSIONS = [
  { id: 'main', badge: 'Основная', title: 'Рабочая версия', text: 'Расчёт, смета, договор и номенклатура — то, чем вы пользуетесь каждый день.', device: 'телефон и компьютер', href: '/app/' },
  { id: 'design', badge: 'Дизайн', title: 'Новая версия для телефона', text: 'Новый интерфейс: проекты, календарь, финансы объекта, построитель чертежа.', device: 'телефон', href: '/design/' },
  { id: 'online', badge: 'Онлайн', title: 'Версия для компьютера', text: 'Канбан проектов, широкий калькулятор, редактор кнопок и смета-документ.', device: 'компьютер', href: ONLINE_URL },
];


export const MAGIC_RESOURCES = [
  { id: 'crm', badge: 'Управление бизнесом', title: 'CRM', text: 'Деньги, склад, монтажные проекты и продажи — в одной системе.', device: 'телефон и компьютер', href: 'https://magic-crm.magic-crm-online.workers.dev' },
  { id: 'lighting', badge: 'Проектирование света', title: 'Светорасчёт', text: 'Освещение помещений, фотометрия и визуализация в 3D.', device: 'телефон и компьютер', href: '', pending: 'Готовится к публикации' },
];
