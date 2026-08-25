---
name: Limpiezas completion rule
description: The conditions and transition points that determine when a cleaning execution can close.
---

Una ejecución de Limpiezas ICMX sólo puede pasar a completada cuando todas sus actividades están completadas o marcadas como no aplicables y todas sus áreas están listas.

**Why:** El usuario puede terminar las actividades antes de activar el último apagador de área, o activar áreas antes de terminar actividades; revisar sólo una de esas operaciones deja ejecuciones válidas atascadas en progreso.

**How to apply:** Reevalúa la condición después de cualquier cambio de actividad y después de cualquier cambio de área, fotos o estado `ready`.