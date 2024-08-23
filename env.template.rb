# ------------------------------------------------------
# Achtung: Wenn diese Datei verändert wurde, muss erneut
# ./config.rb build ausgeführt werden.
# ------------------------------------------------------

# für Produktionsumgebungen bitte auf false setzen
DEVELOPMENT = true

# Präfix für Docker-Container-Namen
PROJECT_NAME = '2d' + (DEVELOPMENT ? 'dev' : '')

# UID für Prozesse, muss in Produktionsumgebungen vtml. auf einen konkreten Wert gesetzt werden
UID = Process::UID.eid

# Domain, auf der die Live-Seite läuft
WEBSITE_HOST = '2d.nhcham.org'

# Präfix für alle URLs
WEB_ROOT = DEVELOPMENT ? 'http://localhost:8025' : "https://#{WEBSITE_HOST}"

# E-Mail für Letsencrypt
LETSENCRYPT_EMAIL = 'specht@gymnasiumsteglitz.de'

# Diese Pfade sind für Development okay und sollten für
# Produktionsumgebungen angepasst werden
LOGS_PATH = './logs'
DATA_PATH = './data'
