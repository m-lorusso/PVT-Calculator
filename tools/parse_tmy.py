#!/usr/bin/env python3
"""
Parse CER DomDecks V30h .tmy files to extract monthly mean ambient air temperature.
Format: 1X,3I2,5I3,I2,I1 — ambient temperature at chars 14-16 in DEG.C * 10.
Usage: python3 parse_tmy.py path/to/file.tmy
"""
import sys

def parse(path):
    sums = [0.0]*12; counts = [0]*12
    with open(path, encoding='latin-1') as f:
        for line in f:
            line = line.rstrip()
            if len(line) < 16: continue
            try:
                m = int(line[1:3]); t = int(line[13:16]) / 10.0
                if 1 <= m <= 12:
                    sums[m-1] += t; counts[m-1] += 1
            except ValueError:
                continue
    return [round(sums[i]/counts[i], 2) for i in range(12)]

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 parse_tmy.py path/to/file.tmy"); sys.exit(1)
    means = parse(sys.argv[1])
    print("Monthly means (Jan→Dec):", means)
    print("Amplitude (max-min):", round(max(means) - min(means), 2), "°C")
