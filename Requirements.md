# Requerimientos de QuickManage

## 1. Objetivo

Crear nuevamente QuickManage como una aplicación web que agilice la organización y el seguimiento de tareas mediante un tablero Kanban.

La nueva aplicación debe permitir migrar fácilmente los datos de la versión actual. Para ello, debe mantener los campos de las tareas y la estructura JSON utilizada para importar y exportar el tablero.

## 2. Alcance

La aplicación permitirá:

- Organizar tareas en columnas.
- Crear, consultar, editar, mover, archivar y eliminar tareas.
- Gestionar prioridades, etiquetas, próximos pasos y comentarios.
- Filtrar y ordenar tareas.
- Importar y exportar tableros en JSON.
- Generar reportes CSV y Excel.
- Guardar los datos localmente en el navegador.
- Utilizar la interfaz en español o inglés y en tema claro u oscuro.

**Fuera de alcance:** la vista de presentación y sus controles. Sin embargo, los datos de presentación que aparezcan en archivos existentes deben conservarse para evitar pérdidas durante la migración.

## 3. Compatibilidad de datos

### 3.1 Formato JSON del tablero

El JSON tiene como raíz un objeto `Board`, sin envolturas adicionales:

```typescript
interface Board {
  columns: Column[];
  presentationColumns?: Column[];
}

interface Column {
  id: string;
  title: string;
  tasks: Task[];
  order: number;
  isArchive?: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reference: string;
  nextStep?: string;
  archivedFromColumnId?: string;
  archivedAt?: string;
  hidden?: boolean;
  columnId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
}

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Reglas de compatibilidad

- Mantener los nombres, tipos y valores de los campos existentes.
- Preservar identificadores, fechas, orden, comentarios, visibilidad y datos de archivado durante la importación y exportación.
- Aceptar archivos que no incluyan los campos opcionales.
- Aceptar datos antiguos que utilicen `client` y `clientColor`, normalizándolos a `tag` y `tagColor` como hace la aplicación actual.
- Si falta una prioridad válida, utilizar `low`, como en la aplicación actual.
- Conservar `presentationColumns`, cuando exista, sin mostrar ni gestionar la vista de presentación.
- Una exportación JSON de la nueva aplicación debe poder importarse nuevamente sin pérdida de información.
- Las fechas generadas por la aplicación deben almacenarse como cadenas ISO 8601.

### 3.3 Prioridades

| Valor | Prioridad | Color actual |
|---|---|---|
| `low` | Baja | `#23C0DF` |
| `medium` | Media | `#FBC833` |
| `high` | Alta | `#E77009` |
| `critical` | Crítica | `#FF5A50` |

La prioridad predeterminada es `low`.

## 4. Requerimientos funcionales

### 4.1 Tablero y columnas

**RF-01.** Al iniciar sin datos guardados, crear un tablero con las columnas predeterminadas de pendientes, en progreso y completadas, con nombres según el idioma activo.

**RF-02.** Permitir crear y renombrar columnas.

**RF-03.** Permitir cambiar el orden de las columnas hacia la izquierda o la derecha.

**RF-04.** Permitir eliminar columnas normales. Antes de eliminar una columna con tareas, informar que estas también se eliminarán y solicitar confirmación.

**RF-05.** Crear automáticamente la columna de archivo cuando se archive la primera tarea. La columna de archivo no debe poder eliminarse mediante la acción normal de eliminación de columnas.

### 4.2 Tareas

**RF-06.** Permitir crear tareas en una columna, con título, descripción, etiqueta, color de etiqueta, prioridad y referencia.

**RF-07.** Exigir título y etiqueta al crear o editar una tarea. No establecer límites de longitud adicionales sin una decisión explícita de producto.

**RF-08.** Asignar automáticamente identificador, columna, orden y fechas de creación y actualización.

**RF-09.** Permitir consultar y editar los datos de una tarea y actualizar su fecha de modificación.

**RF-10.** Permitir eliminar tareas con confirmación.

**RF-11.** Permitir mover tareas mediante arrastrar y soltar dentro de una columna o entre columnas, actualizando su columna y orden.

**RF-12.** Permitir ocultar tareas y mostrar u ocultar las tareas marcadas como ocultas.

### 4.3 Archivo y restauración

**RF-13.** Al archivar una tarea, moverla a la columna de archivo y guardar su columna de origen y fecha de archivado.

**RF-14.** Permitir restaurar una tarea a su columna de origen. Si esta ya no existe, restaurarla a la primera columna activa disponible.

**RF-15.** Al restaurar una tarea, limpiar los datos de archivado y actualizar su fecha de modificación.

**RF-16.** Permitir mostrar u ocultar la columna de archivo.

### 4.4 Próximo paso y comentarios

**RF-17.** Permitir establecer y editar el próximo paso de una tarea.

**RF-18.** Al completar un próximo paso, limpiar el campo y registrar un comentario que indique el paso completado.

**RF-19.** Permitir agregar, editar y eliminar comentarios de una tarea.

**RF-20.** Conservar identificador y fechas de creación y modificación de cada comentario. Los cambios en comentarios deben actualizar la fecha de modificación de la tarea.

### 4.5 Filtros, orden y visualización

**RF-21.** Permitir filtrar por etiqueta y prioridad. Los filtros deben poder combinarse con las opciones de visibilidad de tareas ocultas y archivadas.

**RF-22.** Permitir ordenar las tareas de cada columna por orden manual, prioridad, fecha de creación o fecha de actualización. Para prioridad y fechas, permitir orden ascendente y descendente.

**RF-23.** Permitir seleccionar el texto mostrado en las tarjetas: descripción, próximo paso o último comentario.

## 5. Importación, exportación y persistencia

### 5.1 JSON

**RF-24.** Exportar el tablero completo como JSON con la estructura indicada en la sección 3, incluidos los datos opcionales existentes.

**RF-25.** Importar archivos JSON compatibles y reemplazar el tablero actual, como hace la aplicación existente. La fusión de tableros queda fuera de este alcance.

**RF-26.** Validar el archivo antes de reemplazar los datos. Si el archivo no puede leerse o su estructura no es válida, informar el error y conservar el tablero actual.

### 5.2 Reportes

**RF-27.** Permitir exportar todas las tareas o únicamente las tareas visibles según los filtros actuales, tanto a CSV como a Excel.

**RF-28.** El CSV debe incluir: estado, etiqueta, prioridad, nombre, referencia, próximo paso, fecha de creación, fecha de última modificación, descripción y últimos tres comentarios.

**RF-29.** El Excel debe incluir los mismos datos, además de una columna separada para el último comentario. Debe generarse en una hoja e identificar visualmente la prioridad.

**RF-30.** Los reportes CSV y Excel son formatos de consulta; el formato de migración es JSON.

### 5.3 Almacenamiento local

**RF-31.** Guardar automáticamente el tablero en el almacenamiento local del navegador y recuperarlo al volver a abrir la aplicación.

**RF-32.** Mantener compatibilidad con la clave actual de almacenamiento `quickmanage_board`, o proporcionar una migración explícita de sus datos.

**RF-33.** Permitir borrar el tablero local con confirmación y reiniciar la aplicación con las columnas predeterminadas.

**RF-34.** Informar al usuario si falla una operación de lectura, escritura, importación o exportación.

## 6. Interfaz y calidad

**RNF-01.** La interfaz debe estar disponible en español e inglés.

**RNF-02.** Debe ofrecer tema claro y oscuro.

**RNF-03.** La interfaz debe ser utilizable en pantallas de escritorio y dispositivos móviles.

**RNF-04.** Las acciones destructivas deben identificar claramente sus consecuencias y requerir confirmación.

**RNF-05.** La solución debe poder construirse y verificarse con las herramientas de validación que se definan para el nuevo proyecto. La elección del stack tecnológico no es una condición de compatibilidad de datos.

## 7. Criterios de aceptación

1. Un tablero exportado desde la versión actual se importa en la nueva aplicación conservando columnas, tareas, comentarios, fechas, orden, visibilidad y datos de archivo.
2. Un archivo importado que contenga `presentationColumns` puede exportarse nuevamente sin perder esos datos, aunque la nueva interfaz no los muestre.
3. Los archivos antiguos con `client` y `clientColor` muestran correctamente la etiqueta y su color después de la importación.
4. Un JSON inválido muestra un error y no sustituye el tablero existente.
5. Una tarea puede crearse, editarse, moverse, ocultarse, archivarse, restaurarse y eliminarse.
6. Completar un próximo paso lo limpia y genera el comentario correspondiente.
7. Los filtros, el ordenamiento y las exportaciones completas o filtradas producen los resultados seleccionados.
8. Tras recargar la aplicación, el tablero guardado permanece disponible.
9. No se muestra la vista de presentación ni sus controles.