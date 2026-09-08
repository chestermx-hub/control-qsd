---
name: Limpiezas open report refresh
description: Open cleaning reports must refresh their server snapshot before editing and keep date changes separate from signing.
---

Los reportes de limpieza abiertos deben volver a consultar su ejecución al abrirse desde el histórico y reconciliar áreas/actividades contra el tipo vigente: agregar nuevas, actualizar renombres y retirar las eliminadas. La fecha de ejecución es editable mientras el reporte no esté firmado; firmar/cerrar y cambiar fecha son mutaciones separadas.

**Why:** El histórico puede contener una instantánea anterior a cambios de áreas, y una sincronización sólo incremental deja configuraciones retiradas visibles en reportes abiertos.

**How to apply:** Mantén una recarga por ID al montar la captura abierta, reconcilia sólo ejecuciones no cerradas y valida en backend que la fecha sólo cambie en ejecuciones no cerradas.