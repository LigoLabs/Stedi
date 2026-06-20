"""Verifie que chaque replique de content.js tient dans le sequencement de la scene."""
import re

CPS = 22.44          # PRES_TXT_CPS
LECTURE = 0.35       # PRES_LECTURE
ATTENTE = 6.0        # PRES_ATTENTE, le garde-fou
DEBUT = 20 / 20.0    # PRES_F_TXT a 20 i/s : l'ecriture demarre a 1,00 s de pose

s = open(r"D:/Documents/Developpement/Stedi/stedi/content.js", encoding="utf-8").read()
hooks = re.findall(r"hook:\s*(['\"])(.*?)(?<!\\)\1", s, re.S)
print("%d repliques, frappe a %.2f caracteres par seconde" % (len(hooks), CPS))
pire = 0
for _, h in hooks:
    n = len(h.replace("\\'", "'"))
    frappe = n / CPS
    fiche = DEBUT + frappe + LECTURE
    pire = max(pire, fiche)
    print("  %2d car -> frappe %.2f s, fiche a %.2f s de pose   %s" % (n, frappe, fiche, h[:46]))
print()
print("la plus longue amene la fiche a %.2f s, le garde-fou est a %.1f s : %s"
      % (pire, ATTENTE, "OK" if pire < ATTENTE else "TROP COURT, remonter PRES_ATTENTE"))
