/* Прототипы приложения и лендинг открываются по отдельным ссылкам. */
export const VERSIONS = [
  { id: 'online-new', icon: 'online', primary: true, title: 'Прототип онлайн-версии', text: 'Мои рабочие замеры и расчёты: проекты, чертежи, сметы и номенклатура.', device: 'Компьютер', action: 'Открыть онлайн-версию', href: '/online/' },
  { id: 'design', title: 'Прототип мобильной версии', text: 'Интерфейс для телефона: проекты, календарь, финансы и построение чертежей.', device: 'Телефон', action: 'Открыть мобильную версию', href: import.meta.env.DEV ? '/design/index.html' : '/design/' },
  { id: 'landing', title: 'Лендинг ЗАМЕРX', text: 'Возможности приложения, интерактивные примеры и тарифы подписки.', device: 'Все устройства', action: 'Посмотреть сайт', href: '/landing.html' },
];


export const MAGIC_RESOURCES = [
  { id: 'crm', title: 'CRM', text: 'Деньги, склад, монтажные проекты и продажи — в одной системе.', action: 'Открыть CRM', href: 'https://magic-crm.magic-crm-online.workers.dev' },
  { id: 'lighting', title: 'Светорасчёт', text: 'Освещение помещений, фотометрия и визуализация в 3D.', action: 'Открыть светорасчёт', href: 'https://magic-lighting.vercel.app' },
];
