/* Keyboard access for existing controls, without changing their layout or sizing. */
export function interfaceTemplate(source, css) {
  let tpl = source;
  const replace = (before, after, expected = 1) => {
    const count = typeof before === 'string' ? tpl.split(before).length - 1 : [...tpl.matchAll(before)].length;
    if (count !== expected) throw new Error('interface: expected ' + expected + ' matches, got ' + count + ' for ' + String(before).slice(0, 100));
    tpl = typeof before === 'string' ? tpl.split(before).join(after) : tpl.replace(before, after);
  };
  replace('<sc-if value="{{ isBtnEd }}" hint-placeholder-val="{{ false }}">\n<div style=', '<sc-if value="{{ isBtnEd }}" hint-placeholder-val="{{ false }}">\n<div class="z-ui z-preset-editor" style=');
  replace('<sc-if value="{{ isCalc }}" hint-placeholder-val="{{ false }}">\n        <div style=', '<sc-if value="{{ isCalc }}" hint-placeholder-val="{{ false }}">\n        <div class="z-ui z-calculator" style=');
  replace(/role="dialog" aria-label="(Настройки пресета|Удалить пресет|Норма расхода|Порядок пресетов|Как настроить пресет)"/g, 'class="z-ui" role="dialog" aria-label="$1"', 5);
  replace('<div role="button" aria-label="{{ b.title }}"', '<button class="z-block-toggle" aria-label="{{ b.title }}"');
  replace('</sc-for></sc-if></div></div><sc-if value="{{ b.showSingle }}"', '</sc-for></sc-if></div></button><sc-if value="{{ b.showSingle }}"');
  replace('<div style="font-size:11.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#1E2530;white-space:nowrap">{{ b.title }}', '<div class="z-block-title" style="font-size:11.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#1E2530;white-space:nowrap">{{ b.title }}');
  replace('<div sc-camel-on-click="{{ ln.toggle }}"', '<button class="z-line-toggle" aria-label="Учитывать в смете: {{ ln.n }}" aria-pressed="{{ ln.on }}" sc-camel-on-click="{{ ln.toggle }}"', 2);
  replace(/(<button class="z-line-toggle"[\s\S]*?<\/svg>)<\/div>/g, '$1</button>', 2);
  replace('<span sc-camel-on-click="{{ ln.editNom }}" title="Редактировать номенклатуру"', '<button class="z-line-edit" aria-label="Редактировать номенклатуру: {{ ln.n }}" title="Редактировать номенклатуру" sc-camel-on-click="{{ ln.editNom }}"', 2);
  replace(/(<button class="z-line-edit"[\s\S]*?<\/svg>)<\/span>/g, '$1</button>', 2);
  replace('<span sc-camel-on-click="{{ ln.qReset }}"', '<button class="z-reset" aria-label="Сбросить количество позиции: {{ ln.n }}" sc-camel-on-click="{{ ln.qReset }}"', 2);
  replace('cursor:pointer">сбросить</span>', 'cursor:pointer">сбросить</button>', 2);
  replace('</head>', '<style data-zamer-interface>' + css + '</style></head>');
  return tpl;
}
