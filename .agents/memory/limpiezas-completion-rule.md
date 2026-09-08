---
name: Limpiezas completion rule
description: The conditions and transition points that determine when a cleaning execution can close.
---

Una ejecución de Limpiezas ICMX sólo puede pasar a completada cuando todas sus actividades están completadas o marcadas como no aplicables y todas sus áreas están listas. Las actividades de un área sólo pueden completarse o marcarse como no aplicables después de capturar la foto inicial de esa área; las fotos de actividad sólo son necesarias cuando la actividad tiene `requires_photo`.

**Why:** El usuario puede terminar las actividades antes de activar el último apagador de área, o activar áreas antes de terminar actividades; revisar sólo una de esas operaciones deja ejecuciones válidas atascadas en progreso.

**How to apply:** Bloquea en frontend y backend las acciones de actividad hasta que exista la foto inicial del área. Reevalúa la condición después de cualquier cambio de actividad y después de cualquier cambio de área, fotos o estado `ready`.