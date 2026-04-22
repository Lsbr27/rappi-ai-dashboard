# Store Availability Intelligence Dashboard – Rappi Case

Este proyecto analiza la disponibilidad de tiendas visibles en Rappi a lo largo del tiempo, con el objetivo de identificar patrones de degradación, eventos críticos y oportunidades de monitoreo operativo.

## Problema

En el ecosistema de Rappi, la disponibilidad de tiendas es un elemento clave porque conecta tres actores fundamentales:

* Personas que quieren vender
* Personas que quieren comprar
* Personas que transportan

Cuando la disponibilidad baja, no es solo un número: se afecta directamente la experiencia del usuario y la operación.

El reto consiste en trabajar con series temporales para:

* Entender cuándo y cómo baja la disponibilidad
* Identificar patrones por hora y por día
* Detectar eventos críticos
* Traducir los datos en insights útiles para operaciones

## Enfoque analítico

### Separación entre comportamiento estructural y eventos extremos

Durante el análisis se identificó un evento atípico que distorsionaba completamente la lectura del sistema (una caída abrupta a valores cercanos a cero).

En lugar de eliminarlo, se tomó una decisión clave:

* Mantenerlo visible como evento crítico
* Excluirlo del cálculo del baseline
* Separarlo del comportamiento estructural del sistema

Esto permite diferenciar entre un sistema inestable y un sistema estable con un incidente puntual.

### Definición de un baseline robusto

El baseline no se calcula con promedio, sino con mediana (P50):

* Es más robusta frente a outliers
* Representa mejor el comportamiento típico del sistema

### Dos niveles de referencia

Se definieron dos referencias distintas, cada una con un propósito claro:

* **baselineValue (mediana):**
  Representa el nivel esperado de disponibilidad

* **healthyThreshold (85% del baseline):**
  Define el umbral mínimo saludable del sistema

Esta separación permite distinguir entre:

* degradación normal (patrón)
* incidentes reales (salud del sistema)

## Métricas

El dashboard se construye alrededor de métricas que permiten interpretar el comportamiento del sistema de forma clara:

* **Estabilidad del sistema**
  Porcentaje de lecturas por encima del umbral saludable

* **Magnitud promedio de caída**
  Promedio del delta en eventos negativos

* **Volatilidad acumulada**
  Suma de variaciones negativas por día

* **Tiempo de recuperación**
  Mediana y rango de duración de los incidentes

* **Horas y días problemáticos**
  Porcentaje de lecturas por debajo del nivel esperado (baseline)
