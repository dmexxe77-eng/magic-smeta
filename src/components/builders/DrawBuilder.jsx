import { useEffect, useRef } from "react";
import { T } from "../../theme.js";
import { newR } from "../../utils/roomUtils.js";
import { createDrawEditor } from "./drawEditor/editor.js";
import "./drawEditor/editor.css";

/* Ручное построение: прямоугольник, овал или многоугольник с размерами → помещение в расчёт.
   Сам редактор императивный (drawEditor/editor.js), здесь только монтирование и перевод результата в Room. */
export default function DrawBuilder({ onFinish, onBack, existingCount = 0 }) {
  const ref = useRef(null);
  const cb = useRef({ onFinish, onBack });
  cb.current = { onFinish, onBack };

  useEffect(() => {
    const ed = createDrawEditor(ref.current, {
      roomName: "Помещение " + (existingCount + 1),
      onBack: () => { if (cb.current.onBack) cb.current.onBack(); },
      onFinish: ({ name, verts, area, perim, draw }) => {
        const rm = newR(name);
        rm.v = verts;           /* полилиния в метрах: дуги и скругления уже разбиты на отрезки */
        rm.aO = area;           /* точные площадь и периметр из редактора */
        rm.pO = perim;
        rm.canvas.qty = area;
        rm.mainProf.qty = perim;
        rm.draw = draw;         /* исходная модель чертежа: базовая фигура, правки, размеры */
        if (cb.current.onFinish) cb.current.onFinish(rm);
      },
    });
    return () => ed.destroy();
  }, []);

  const vars = {
    "--ground": T.bg, "--paper": T.bg, "--surface": T.card, "--surface2": T.card2,
    "--ink": T.text, "--ink2": T.sub, "--ink3": T.dim, "--line": T.border, "--grid": T.muted,
    "--fill": T.pillBg, "--pri": T.accent,
  };
  return <div ref={ref} className="zd" style={vars} />;
}
