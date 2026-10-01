"""
Regenera data/products.json a partir de un Excel de tarifa.

Uso:
    pip install openpyxl
    python tools/export_catalog.py "ruta/al/nuevo/Tarifa.xlsx" "NombrePestaña"

Espera que la pestaña tenga, a partir de la fila 2, las columnas:
    B = Código, C = Descripción, D = Url ficha técnica,
    E = PVP, F = RAEE, ... M = % descuento habitual (dto1)
Igual que la pestaña "2023S" del Excel original de ofertas.
"""
import sys
import json
import openpyxl


def to_num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    s = str(v).replace(',', '.').strip()
    try:
        return float(s)
    except ValueError:
        return None


def main():
    if len(sys.argv) < 2:
        print("Uso: python export_catalog.py archivo.xlsx [NombrePestaña]")
        sys.exit(1)

    path = sys.argv[1]
    sheet_name = sys.argv[2] if len(sys.argv) > 2 else None

    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet_name] if sheet_name else wb.active

    products = []
    for row in ws.iter_rows(min_row=2):
        codigo = row[1].value  # columna B
        if codigo is None or str(codigo).strip() == '':
            continue
        products.append({
            'codigo': str(codigo).strip(),
            'desc': (row[2].value or '').strip() if isinstance(row[2].value, str) else row[2].value,
            'ficha': row[3].value,
            'pvp': to_num(row[4].value),
            'raee': to_num(row[5].value),
            'dto1': to_num(row[12].value) if len(row) > 12 else None,
        })

    with open('data/products.json', 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False)

    print(f"Guardados {len(products)} productos en data/products.json")


if __name__ == '__main__':
    main()
