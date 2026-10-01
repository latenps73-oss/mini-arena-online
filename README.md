# Mini Arena Online

Versión revisada para jugar desde el celular y compartir una misma arena con amigos.

## Archivos del proyecto

- `package.json`
- `server.js`
- `public/index.html`

## Ejecutar en tu PC

1. Instala Node.js 18 o superior.
2. Abre una terminal dentro de esta carpeta.
3. Ejecuta:

```bash
npm install
npm start
```

4. Abre `http://localhost:3000`.

## Publicarlo en Render

En GitHub, sube **el contenido de esta carpeta**, de modo que `package.json` y `server.js` queden en la raíz y `public/index.html` dentro de `public/`.

En Render crea un **Web Service** conectado a ese repositorio.

- Build Command: `npm install`
- Start Command: `npm start`

Render usará automáticamente el puerto que proporciona mediante `process.env.PORT`.

## Controles

- Flechas o WASD: moverse.
- `Ataque`: daña enemigos y jugadores cercanos.
- `Dash`: desplazamiento rápido en la dirección pulsada; sin dirección, hace dash hacia arriba.
- Moneda: +25 puntos.
- Derrotar enemigo: +100 puntos.
- Golpear a otro jugador: +10 puntos.
- Cuando un jugador llega a 0 HP, reaparece y pierde 50 puntos.

## Correcciones incluidas en la versión 1.1.0

- Movimiento de enemigos desacoplado de la cantidad de jugadores.
- Validación segura de los datos recibidos del navegador.
- Límite de 24 jugadores simultáneos.
- Reconexión automática del navegador.
- Botones desactivados hasta entrar a la partida.
- Controles táctiles con liberación segura al perder el foco.
- Servido de `public/` mediante una ruta absoluta y compatible con Render.
- Temporizador de reaparición de enemigos sin crear varios `setTimeout` innecesarios.
- Respawn de jugadores en una posición aleatoria con separación básica.
