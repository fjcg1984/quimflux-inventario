# QUIMFLUX Inventario

Aplicación web independiente para control de inventario QUIMFLUX.

## Módulos
- Vista general con búsqueda, filtros y semáforo de stock.
- Entradas que incrementan existencias.
- Salidas que descuentan existencias y bloquean stock insuficiente.
- Centro de reposición.
- Historial de movimientos.
- Alta de artículos con categorías, códigos, unidad y stock mínimo.

## Arquitectura
- Frontend estático: HTML, CSS y JavaScript.
- Datos y autenticación: Supabase.
- Repositorio: GitHub.
- Proyecto Supabase independiente de los demás desarrollos QUIMFLUX.

La clave incluida en `config.js` es una publishable/anon key diseñada para uso público del frontend. Nunca incluir claves `service_role` o secretos.
