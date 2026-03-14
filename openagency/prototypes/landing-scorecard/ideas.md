# OpenAgency by Polanyi — Brainstorm de Diseño

## Contexto
Landing page estilo Stripe.com para OpenAgency — "El Stripe de Advertising Intelligence para Agentes AI". Paleta negro/blanco/grises. Fuente Raleway. Audiencia: CMOs/CFOs/CIOs, Developers, Inversores.

---

<response>
<idea>

## Idea 1: "Terminal Noir" — Estética de Infraestructura Digital

**Design Movement**: Neo-Brutalism Digital mezclado con estética de terminal/código. Inspirado en la identidad visual de empresas como Linear, Vercel y Raycast.

**Core Principles**:
1. La interfaz como código — todo elemento visual refuerza que esto es infraestructura, no un SaaS bonito
2. Contraste extremo — negro profundo contra blanco puro, sin tonos intermedios innecesarios
3. Precisión tipográfica — cada palabra ocupa su espacio con intención quirúrgica
4. Datos como ornamento — las visualizaciones de datos reemplazan a las ilustraciones decorativas

**Color Philosophy**: Negro (#000000) como canvas principal que comunica sofisticación técnica y seriedad enterprise. Blanco (#FFFFFF) para texto y elementos de alto contraste. Grises (#1a1a1a, #2a2a2a, #666, #999) para jerarquía y profundidad. Un único acento: verde terminal (#00FF41) para CTAs y elementos interactivos — evoca la terminal, el código, la ejecución.

**Layout Paradigm**: Grid asimétrico con secciones de ancho completo que alternan entre fondos negros y blancos. Hero con texto masivo alineado a la izquierda. Secciones de código real intercaladas. Cards con bordes de 1px que flotan sobre fondos oscuros.

**Signature Elements**:
1. Bloques de código animados que muestran llamadas API reales de OpenAgency
2. Líneas de conexión estilo diagrama de flujo entre secciones (como un DAG visual)
3. Cursor parpadeante en el hero que "escribe" el tagline

**Interaction Philosophy**: Hover states que revelan profundidad técnica. Los elementos se iluminan como terminales al interactuar. Scroll que activa animaciones de datos fluyendo.

**Animation**: Entrada de texto tipo typewriter para headlines. Counters animados para estadísticas. Fade-in suave de secciones al scroll. Partículas de datos que fluyen entre nodos en el background.

**Typography System**: Raleway 800 para headlines (tracking tight). Raleway 400 para body. Monospace (JetBrains Mono o similar) para bloques de código y datos técnicos.

</idea>
<probability>0.08</probability>
</response>

<response>
<idea>

## Idea 2: "White Paper Elegance" — Estética Editorial de Alto Nivel

**Design Movement**: Swiss Design / International Typographic Style mezclado con editorial de lujo tipo McKinsey o Bain reports.

**Core Principles**:
1. La tipografía ES el diseño — Raleway en sus diferentes pesos crea toda la jerarquía visual
2. Espacio negativo como lujo — amplios márgenes que comunican confianza y autoridad
3. Datos como narrativa — cada número cuenta una historia, no solo decora
4. Credibilidad institucional — el diseño transmite que esto es serio, enterprise-grade

**Color Philosophy**: Blanco (#FAFAFA) como base dominante que comunica claridad y transparencia. Negro (#0A0A0A) para texto principal con máximo contraste. Escala de grises cuidadosamente calibrada (#1a1a1a, #333, #666, #999, #ccc, #e5e5e5) para crear profundidad sin color. Acento mínimo: un gris azulado (#4A5568) para links y elementos interactivos.

**Layout Paradigm**: Layout editorial con columnas asimétricas. Hero con tipografía monumental centrada. Secciones que alternan entre full-width y contenido estrecho (max-w-3xl) para crear ritmo de lectura. Uso de reglas horizontales finas como separadores.

**Signature Elements**:
1. Números estadísticos gigantes (200px+) que aparecen como elementos de fondo
2. Líneas diagonales sutiles que conectan secciones como un flujo de datos
3. Cards con sombras muy sutiles y bordes casi invisibles

**Interaction Philosophy**: Minimalista y precisa. Hover states que añaden un underline elegante. Transiciones suaves de 300ms. Sin efectos llamativos — la información habla por sí misma.

**Animation**: Fade-up suave al scroll. Contadores numéricos que se incrementan al entrar en viewport. Parallax sutil en backgrounds. Líneas que se dibujan progresivamente.

**Typography System**: Raleway 900 para hero headline (72-96px). Raleway 700 para section headers (36-48px). Raleway 400 para body (18px, line-height 1.7). Raleway 300 para subtítulos y labels.

</idea>
<probability>0.06</probability>
</response>

<response>
<idea>

## Idea 3: "Dark Infrastructure" — Estética de Plataforma API Premium

**Design Movement**: Inspirado directamente en Stripe.com pero invertido a dark mode. Mezcla de la sofisticación de Stripe con la oscuridad de Linear y la densidad informativa de Vercel.

**Core Principles**:
1. Dark-first como statement — el fondo negro dice "esto es infraestructura seria, no un juguete"
2. Gradientes monocromáticos — transiciones de negro a gris oscuro crean profundidad sin color
3. Glass morphism sutil — elementos con backdrop-blur sobre fondos oscuros
4. Código como hero — snippets de API son elementos de primera clase, no secundarios

**Color Philosophy**: Negro profundo (#09090B) como base. Gradientes de gris (#111, #1a1a1a, #222) para crear capas de profundidad. Blanco (#FAFAFA) para texto principal. Gris medio (#71717A) para texto secundario. Acento: blanco puro para CTAs principales — el botón blanco sobre negro es el statement más fuerte.

**Layout Paradigm**: Full-width hero con gradiente radial sutil. Grid de 12 columnas con cards que tienen bordes de 1px en gris oscuro (#27272A). Secciones alternando entre fondo negro sólido y fondo con gradiente sutil. Sticky nav con backdrop-blur.

**Signature Elements**:
1. Gradiente radial sutil en el hero que simula una fuente de luz
2. Cards con borde gris oscuro y efecto glow sutil al hover
3. Visualización animada de un flujo agent-to-agent (nodos conectados)

**Interaction Philosophy**: Hover states con glow sutil. Cards que elevan su sombra al hover. Botones con transición de background. Nav items con underline animado. Todo se siente premium y responsivo.

**Animation**: Entrada staggered de elementos al scroll. Gradiente del hero que pulsa sutilmente. Nodos de la visualización A2A que se conectan progresivamente. Números que cuentan hacia arriba. Smooth scroll entre secciones.

**Typography System**: Raleway 800 para hero (64-80px, tracking -0.02em). Raleway 600 para section titles (40-48px). Raleway 400 para body (16-18px). JetBrains Mono para code snippets y datos técnicos.

</idea>
<probability>0.09</probability>
</response>

---

## Decisión: Idea 3 — "Dark Infrastructure"

Selecciono la Idea 3 porque:
1. El dark mode refuerza el posicionamiento como infraestructura seria (como Stripe, pero para agentes)
2. La paleta negro/blanco/grises se maximiza en dark mode con gradientes monocromáticos
3. El glass morphism y los efectos de glow crean sofisticación sin necesidad de color
4. Los code snippets como elementos hero comunican directamente "API-first"
5. Es la que mejor captura la esencia de "construimos un API, no un checkout bonito"
