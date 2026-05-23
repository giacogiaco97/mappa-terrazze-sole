# Schema CSV terrazze BCN (verificato 2026-05-23)

Dataset CKAN: `terrasses-comercos-vigents` — risorsa più recente: `2025_2s_data_set_opendata_terrasses.csv` (last_modified 2026-01-07).

URL osservato:
`https://opendata-ajuntament.barcelona.cat/data/dataset/9cefbfa2-bcdf-44a0-b63a-372b48f9da93/resource/3be007e1-d1c8-4480-ab33-ba30da5eda1d/download/2025_2s_data_set_opendata_terrasses.csv`

**Separatore: `;`** (punto e virgola).
**Quoting: doppi apici** intorno alle colonne testuali; alcune numeriche non quotate.
**Encoding decimali:** `.` (es. `"41.4102259966535"`).

## Header letterale

```
"DATA_EXPLO";"OCUPACIO";"CODI_DISTRICTE";"NOM_DISTRICTE";"CODI_BARRI";"NOM_BARRI";"EMPLACAMENT";"SUPERFICIE_OCUPADA";"TAULES";"CADIRES";"TAULES_VORERA";"CADIRES_VORERA";"TAULES_CALCADA";"CADIRES_CALCADA";"ORDENACIO";"VIGENCIA";"X_ETRS89";"Y_ETRS89";"LATITUD";"LONGITUD"
```

## Esempio di riga

```
1/1/2026 0:00:00;"Terrasses en Via Pública";2;"Eixample";6;"la Sagrada Família";"AV. GAUDI, 66";"12";4.00;16.00;4.00;16.00;0.00;0.00;"General";"Anual";31007048;84626422;"41.4102259966535";"2.17451116103995"
```

Conteggio righe totale (incluso header): ~6901 → ~6900 record.

## Mappatura → tipo `Terrace`

Il dataset ufficiale **non contiene il nome commerciale del locale**: è un registro amministrativo
delle autorizzazioni. Usiamo `EMPLACAMENT` (l'indirizzo dell'autorizzazione) sia come `name` che
come `address`. In Fase 3 il piano prevede di arricchire con OSM (`amenity=cafe|restaurant`) per
ottenere i nomi commerciali.

Inoltre **non esiste una colonna `ID`** stabile: generiamo `T-${i}` dall'indice di riga del CSV.
Una alternativa più robusta sarebbe hashare `lat,lng,EMPLACAMENT` — ma per l'MVP l'indice basta.

| Campo `Terrace` | Sorgente CSV | Note |
|---|---|---|
| `id` | `T-${row_index}` (1-based) | non esiste un ID stabile nel dataset |
| `name` | `EMPLACAMENT` | usato l'indirizzo come nome (no NOM_LOCAL) |
| `address` | `EMPLACAMENT` | indirizzo dell'autorizzazione |
| `lat` | `LATITUD` | parseFloat, decimale `.` |
| `lng` | `LONGITUD` | parseFloat, decimale `.` |
| `tables` | `TAULES` | totale già aggregato (= `TAULES_VORERA + TAULES_CALCADA`) |
| `chairs` | `CADIRES` | totale già aggregato |
| `surfaceSqM` | `SUPERFICIE_OCUPADA` | m² occupati |
| `neighborhood` | `NOM_BARRI` | quartiere (es. "la Sagrada Família") |

## Filtri sulle righe

- Scartare righe con `LATITUD` o `LONGITUD` non parsabili / `0`.
- Mantenere comunque righe con `TAULES = 0` (alcune terrazze hanno solo sedie).
