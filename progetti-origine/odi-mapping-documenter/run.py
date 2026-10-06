#!/usr/bin/env python3
"""
Script di avvio rapido per ODI Mapping Documenter.
Permette di lanciare il tool facilmente dalla root del progetto.
Supporta file singoli o intere cartelle.
"""

import sys
from pathlib import Path


def main():
    print("=" * 55)
    print("      ODI 12c Mapping Documenter - Avvio Tool      ")
    print("=" * 55)
    print("\n[*] Inizializzazione del processo in corso...\n")

    # Aggiunge la cartella 'src' al path di Python
    root_dir = Path(__file__).parent
    src_dir = root_dir / "src"
    sys.path.insert(0, str(src_dir))

    # Verifica se è stato passato un argomento (file o cartella)
    if len(sys.argv) < 2:
        # Se non viene passato, cerca la cartella 'data' di default
        default_dir = root_dir / "data"
        if default_dir.exists() and any(default_dir.glob('*.xml')):
            print(f"[!] Nessun argomento fornito. Uso la cartella di default: {default_dir.name}/\n")
            sys.argv.append(str(default_dir))
        else:
            print("[X] Errore: Nessun file o cartella fornito.")
            print("\nUtilizzo:")
            print("  python run.py <percorso_file_xml_o_cartella> [--format all|technical|business|flow|csv]")
            print("\nEsempi:")
            print("  python run.py data/SmartExport.xml")
            print("  python run.py data/                         (Processa tutti i file XML nella cartella e sottocartelle)")
            print("  python run.py data/ --format csv            (Genera solo i CSV per tutti i file nella cartella e sottocartelle)")
            print("  python run.py data/mia_cartella             (Processa tutti i file XML in data/mia_cartella e sottocartelle)\n")
            sys.exit(1)

    # Importa ed esegue la funzione main dal modulo in src/
    try:
        from main import main as run_main
        run_main()
    except ImportError as e:
        print(f"\n[X] Errore di importazione: {e}")
        print("Assicurati che la cartella 'src' contenga il file 'main.py'.")
        sys.exit(1)
    except Exception as e:
        print(f"\n[X] Si è verificato un errore durante l'esecuzione: {e}")
        sys.exit(1)

    print("\n[OK] Processo terminato!")

if __name__ == "__main__":
    main()
