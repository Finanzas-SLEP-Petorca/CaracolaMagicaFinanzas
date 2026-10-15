# Caracola Mágica Finanzas

Oráculo oficial · no vinculante. Una página de broma para el equipo de Finanzas: una caracola dorada en espiral, sobre un fondo de mar con burbujas, que responde al azar tus consultas presupuestarias.

**Sitio publicado:** https://finanzas-slep-petorca.github.io/CaracolaMagicaFinanzas/

## Cómo se usa

1. Escribe tu pregunta (o no escribas nada y pregunta en silencio).
2. Pide la respuesta de cualquiera de estas formas:
   - **Tira de la cuerda:** arrastra la argolla hacia abajo al menos 60 px y suelta. Un clic (o Enter) sobre la argolla hace un tirón automático.
   - **Toca la caracola.**
   - **Presiona Enter** en el campo de la pregunta.
3. La caracola delibera y responde con efectos de sonido y voz. El botón «Sonido encendido / apagado» silencia todo; la preferencia queda guardada.

Respuestas sin validez ante Contraloría. No reemplaza el CDP, el oficio ni el criterio de la jefatura.

## Registro de consultas (local, por navegador)

Cada consulta se guarda **solo en el navegador de quien la hace** (`localStorage`); no hay servidor ni base de datos y nadie más ve tus preguntas. Si usas otro navegador, otro equipo o el modo incógnito, verás otro registro (o ninguno).

- Clave: `caracola-finanzas:registro:v1`, un arreglo JSON de `{ id, fecha, pregunta, respuesta, modo, via }`, con `via` = `cuerda`, `caracola` o `teclado`.
- Se guardan como máximo 2.000 consultas; al superarlas se descartan las más antiguas.
- «Ver registro completo» abre un panel con búsqueda, resumen (total y las 3 respuestas que más han salido), exportación a CSV (separador `;`, UTF-8 con BOM, listo para Excel en español) y un botón para borrar el registro.
- Si el navegador no permite guardar (incógnito, almacenamiento bloqueado o lleno), la caracola funciona igual y aparece el aviso «Este navegador no permite guardar el registro.».
- La preferencia de sonido se guarda en `caracola-finanzas:sonido`.

## Personalizar (`CONFIG`)

Al inicio de [`assets/app.js`](assets/app.js) está el objeto `CONFIG`:

```js
const CONFIG = {
  modo: 'Simples + Finanzas', // o 'Solo simples'
  acento: '#FF8A5B',          // sugeridos: '#FF8A5B', '#FFD27A', '#7FE0C8', '#B9A6FF'
  voz: true                   // false: sin voz, solo efectos de sonido
};
```

- **`modo`**: `'Simples + Finanzas'` usa todas las respuestas; `'Solo simples'` usa solo las genéricas («Sí.», «No.», «Depende.»…).
- **`acento`**: color de la palabra «Finanzas», la argolla y los títulos de sección. Acepta cualquier color CSS.
- **`voz`**: activa o desactiva la lectura en voz alta de la respuesta.

Edita el archivo, haz commit en `main` y GitHub Pages publica el cambio en uno o dos minutos.

## Agregar respuestas

Justo debajo de `CONFIG`, en `assets/app.js`, está `RESPUESTAS`:

```js
const RESPUESTAS = {
  simples: ['Sí.', 'No.', 'Depende.', /* … */],
  finanzas: ['Solo con CDP.', 'Sí, pero por REX.', /* … */, 'Tu nueva respuesta.']
};
```

Agrega la frase entre comillas simples, separada por coma, en la lista que corresponda (`simples` aparece en ambos modos; `finanzas` solo en «Simples + Finanzas»). Si tu frase lleva un apóstrofo, usa comillas dobles: `"Lo dejo pa' mañana."`.

Para que la voz pronuncie bien una sigla, revisa la función `say()`, que ya convierte `MEMO`, `REX` y `DIPRES`.

## Estructura

```
index.html          Página (marcado)
assets/styles.css   Estilos y animaciones (incluye prefers-reduced-motion)
assets/app.js       Lógica: oráculo, cuerda, sonidos, voz y registro
assets/favicon.svg  Ícono
.nojekyll           Publica los archivos tal cual en GitHub Pages
```

Sin frameworks, sin paso de build y sin dependencias; el único recurso externo es Google Fonts (Lilita One y Figtree).

## Probar en local

```sh
python3 -m http.server 8000
```

y abre http://localhost:8000/.

## Publicación

GitHub Pages sirve el sitio desde la rama `main`, carpeta raíz (Settings → Pages → «Deploy from a branch» → `main` / `/ (root)`). Todas las rutas son relativas, así que funciona bajo `/CaracolaMagicaFinanzas/`.
