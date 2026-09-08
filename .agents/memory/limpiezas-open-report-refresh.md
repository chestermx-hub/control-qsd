---
name: Limpiezas open report refresh
description: Open cleaning reports must refresh their server snapshot before editing and keep date changes separate from signing.
---

Los reportes de limpieza abiertos deben volver a consultar su ejecución al abrirse desde el histórico. La fecha de ejecución es editable mientras el reporte no esté firmado; firmar/cerrar y cambiar fecha son mutaciones separadas.

**Why:** El histórico puede contener una instantánea anterior a cambios de áreas y el endpoint de firma no debe ser el único camino para actualizar un reporte en progreso.

**How to apply:** Mantén una recarga por ID al montar la captura abierta y valida en backend que la fecha sólo cambie en ejecuciones no cerradas.