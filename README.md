# FluidManage

Tablero Kanban local para organizar tareas. Los requisitos están en [Requirements.md](Requirements.md).

## Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` / `npm run test:watch` | Pruebas con Vitest |
| `npm run coverage` | Pruebas con cobertura |
| `npm run verify` | Lint, tipos, pruebas y build de producción |
| `npm run preview` | Sirve el build de producción |

## Estructura

- `src/domain`: reglas del tablero como funciones puras (operaciones, validación del JSON, filtros y orden).
- `src/reports`: filas de reporte, CSV y Excel. La librería de Excel se carga bajo demanda.
- `src/storage`: `localStorage` (clave `quickmanage_board`, mismo formato que la versión anterior) y lectura de archivos.
- `src/store`: estado externo a React con guardado diferido.
- `src/components`, `src/i18n`: interfaz y traducciones.

## Seguridad

- El contenido importado se trata como no confiable: se valida la estructura, se descartan claves como `__proto__` y se limita el tamaño del archivo.
- Los textos se renderizan siempre como texto; ESLint prohíbe `dangerouslySetInnerHTML`.
- Los colores de etiqueta solo llegan a los estilos si son hexadecimales válidos.
- CSV protegido contra inyección de fórmulas; en Excel todas las celdas se escriben como texto.
- El build de producción incluye una CSP estricta sin acceso a red.

Al desplegar, añade en el servidor las cabeceras que una etiqueta `<meta>` no puede aplicar, como `Content-Security-Policy: frame-ancestors 'none'` y `X-Content-Type-Options: nosniff`.
