# Guía Técnica: Constelación de Nodos Interactivos (Hero Section)

Este documento detalla el funcionamiento lógico, matemático y técnico del fondo interactivo de partículas (`CanvasParticles`) implementado en la sección Hero de la página de inicio en [index.tsx](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/index.tsx).

---

## 🌌 Concepto

El fondo consiste en un sistema de partículas (o "nodos") flotando libremente en un espacio bidimensional. Cuando dos partículas se encuentran a una distancia menor de un umbral establecido (120px), se dibuja un filamento o línea de conexión entre ellas con una opacidad proporcional a su cercanía, simulando una constelación de estrellas reactiva. 

Adicionalmente, el sistema es sensible a la posición del mouse del usuario: cuando el puntero se acerca a las partículas (a menos de 180px), estas experimentan una fuerza de atracción que las desplaza suavemente hacia el mouse, logrando una interacción orgánica y fluida.

---

## ⚙️ Algoritmo y Mecánica Física

### 1. Inicialización de Partículas
Se crean `75` partículas de forma aleatoria dentro de las dimensiones del lienzo (`width` y `height`). Cada partícula está definida por un objeto con las siguientes propiedades físicas:

- **Posición ($x, y$)**: Coordenadas actuales del nodo en el plano cartesiano del canvas.
- **Velocidad ($v_x, v_y$)**: Vector de velocidad que determina la dirección y velocidad del movimiento en cada cuadro de animación (valores pequeños entre `-0.25` y `0.25` px/frame para un efecto atmosférico lento).
- **Tamaño ($size$)**: Radio del círculo dibujado (entre `1` y `3.5` píxeles) para simular profundidad espacial.

### 2. Ciclo de Animación (`requestAnimationFrame`)
Para lograr una animación fluida a 60 cuadros por segundo (FPS) sin sobrecargar el procesador, se utiliza `requestAnimationFrame`. En cada iteración:
1. Se limpia el lienzo por completo con `ctx.clearRect(0, 0, width, height)`.
2. Se actualizan las posiciones sumando la velocidad actual ($x_{new} = x_{old} + v_x$).
3. Se calcula la física de colisión contra los bordes (si toca el borde izquierdo, derecho, superior o inferior, se multiplica la velocidad correspondiente por `-1` para rebotar).
4. Se calcula la atracción del mouse.
5. Se dibujan los filamentos de conexión.
6. Se dibuja la partícula.

### 3. Física de Atracción al Mouse
Cuando el cursor entra al área del Hero (`mouse.active = true`), calculamos la distancia euclidiana entre el cursor y cada partícula $i$:

$$d = \sqrt{(x_{mouse} - x_i)^2 + (y_{mouse} - y_i)^2}$$

Si la distancia es menor a $180\text{px}$:
1. Obtenemos el vector de dirección normalizado:
   $$\vec{u} = \left(\frac{x_{mouse} - x_i}{d}, \frac{y_{mouse} - y_i}{d}\right)$$
2. Aplicamos un factor de atracción que jala a la partícula en esa dirección:
   $$x_i = x_i + u_x \cdot \text{fuerza}$$
   $$y_i = y_i + u_y \cdot \text{fuerza}$$
Esto hace que las partículas sigan al cursor de manera elástica y suave.

### 4. Dibujo de Filamentos (Constelación)
Para conectar los nodos, realizamos una comparación cruzada (nested loop) entre cada par de partículas $p_1$ y $p_2$.
Si la distancia entre ambas es menor a $120\text{px}$, se traza una línea con un degradado de opacidad:

$$\alpha = \left(1 - \frac{\text{distancia}}{120}\right) \times 0.15$$

Esta ecuación lineal decreciente garantiza que a menor distancia, la línea sea más brillante y definida, y que al alcanzar los 120px de separación se desvanezca por completo a una opacidad de $0.0$.

---

## ⚡ Optimización y Rendimiento

El renderizado de animaciones en navegadores puede ser demandante. El componente está optimizado para garantizar un rendimiento óptimo en dispositivos móviles y de escritorio mediante:

1. **Evitar Re-renders en React**: Toda la física, el ciclo de animación y el estado del mouse se controlan directamente en referencias de JavaScript (`useRef`) y contextos de Canvas nativos. No se utiliza estado de React (`useState`) para las coordenadas o bucles de dibujo, evitando ciclos innecesarios de reconciliación en el DOM virtual de React.
2. **Dimensionamiento Responsivo Inteligente**: Se incluye un event listener para el evento `resize` de la ventana que ajusta dinámicamente los límites del canvas interno para evitar que el renderizado se pixelee o distorsione en pantallas Retina/4K.
3. **Liberación de Memoria (Cleanup)**: Al desmontar el componente (cambio de ruta en Next.js, por ejemplo):
   - Se cancela el cuadro de animación pendiente con `cancelAnimationFrame`.
   - Se remueven todos los escuchadores de eventos (`mousemove`, `resize`, `mouseenter`, `mouseleave`) del elemento padre y de la ventana global.
   - Esto previene fugas de memoria (memory leaks) y consumo residual de CPU en segundo plano.
